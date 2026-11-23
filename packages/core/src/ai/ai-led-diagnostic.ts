/**
 * The AI-led diagnostic as a LangGraph graph: the model chooses or writes each question, marks each written answer
 * and explains the result, while the published rule alone sets each question's level and the result (MVP S23,
 * ADR-0012, ADR-0019).
 *
 * @remarks The graph pauses with `NodeInterrupt` and is rebuilt on every turn from the progress the session record
 * holds, through `updateState` as the routing node, so resuming after a reload and going on after a click are one
 * path (spike S2). Its `MemorySaver` lives for one turn and is never written anywhere (ADR-0017). It pauses before
 * every AI call with exactly what the call would send and to which model, and runs that call only when the person
 * approves that same request to that same model, so nothing is sent before they agree (S23.1). The browser never
 * uses `interrupt()`, which needs Node's async context. This module is loaded only when an AI-led diagnostic runs,
 * so LangGraph is never downloaded otherwise.
 *
 * Only the progress, which the record schemas have checked, goes through LangGraph's checkpoint. What a turn
 * carries besides (the approval, the pause, the call records and anything dropped) stays in the turn's own memory:
 * a pause can hold the model's unchecked answer, which LangGraph's checkpoint reader could otherwise turn into
 * objects.
 * @packageDocumentation
 */
import { Annotation, END, MemorySaver, NodeInterrupt, START, StateGraph } from "@langchain/langgraph/web";
import type { z } from "zod";
import { QUESTION_BANK_RULE, diagnosticResult, nextLevel } from "../diagnostic.ts";
import { err, ok, type Result } from "../result.ts";
import type { AssessmentItem } from "../schemas/assessment-item.ts";
import type { AiLedItem, AiLedStep, DiagnosticExplanation } from "../schemas/evidence.ts";
import type { AiProvenance } from "../schemas/fields.ts";
import { modelName, type ModelProvider } from "./provider.ts";
import { runTask, type CallRecord, type TaskFailure } from "./run-task.ts";
import { prepareCall, type PreparedCall, type Task } from "./task.ts";
import type { AnsweredQuestion, DiagnosticMaterial, Scale } from "./tasks/diagnostic-material.ts";
import { explainDiagnostic } from "./tasks/explain-diagnostic.ts";
import { markDiagnosticAnswer } from "./tasks/mark-diagnostic-answer.ts";
import { writeDiagnosticItem } from "./tasks/write-diagnostic-item.ts";

/** What a turn of the diagnostic needs besides its progress: the model, the skill, the bank and the material. */
export interface AiLedContext {
  /** Where the calls go. */
  readonly provider: ModelProvider;
  /** The provider's own ID for the model chosen at the start (MVP S23.1). */
  readonly model: string;
  /** The clock to time each call by. */
  readonly now: () => Date;
  /** The skill's slug: only the bank's items for it are offered. */
  readonly slug: string;
  /** The skill: its name, what it covers and what each level means for it. */
  readonly skill: string;
  /** Pharoam's scale. */
  readonly scale: Scale;
  /** The question bank's items. */
  readonly bank: readonly AssessmentItem[];
  /**
   * The person's evidence, claims and earlier results about the skill, as sent (MVP S23.1).
   *
   * @remarks Built the same way every turn, in a fixed order, so the call approved is the call made.
   */
  readonly material: z.input<typeof DiagnosticMaterial>;
}

/** An explanation as the session keeps it: what it says, with the call that wrote it. */
export type HeldExplanation = DiagnosticExplanation & { readonly ai: AiProvenance };

/**
 * How far the diagnostic has got: the fields its session record holds (data model §10).
 *
 * @remarks This is the graph's only state; a turn rebuilds the graph from it.
 */
export interface AiLedProgress {
  /** The level it started at. */
  readonly start: number;
  /** The questions asked and marked, in order. */
  readonly steps: readonly AiLedStep[];
  /** The question posed now, in full. */
  readonly posed?: AiLedItem;
  /** An answer to the posed question waiting for the model's marking. */
  readonly answer?: string;
  /** The explanation, once given. */
  readonly explanation?: HeldExplanation;
}

/** A call as the person is asked to approve it: exactly what it sends, and the model it goes to. */
export interface Approval {
  /** What the call sends, part by part, with its size. */
  readonly call: PreparedCall;
  /** The provider and model it goes to, as the `ai` block records them, such as `anthropic/claude-sonnet-5-5`. */
  readonly model: string;
}

/**
 * What the person did this turn: answered the question posed, approved the call shown, or neither, to see where
 * the diagnostic is.
 *
 * @remarks One at a time, so an answer never goes to a model in the same turn it is given: approving the marking
 * call is a turn of its own (MVP S23.1).
 */
export type AiLedTurn =
  | { readonly answer: number | string; readonly approve?: never }
  | { readonly approve: Approval; readonly answer?: never }
  | { readonly answer?: never; readonly approve?: never };

/** Where the diagnostic paused, and why. */
export type AiLedPause =
  /**
   * Before an AI call, with exactly what it would send and to which model; it runs once the person approves it
   * (MVP S23.1). `stale` says an approval came for a call that has since changed.
   */
  | ({ readonly kind: "approve"; readonly stale: boolean } & Approval)
  /** For the person's answer to the question posed. */
  | { readonly kind: "answer"; readonly posed: AiLedItem }
  /** A call failed or its answer was refused; approving the same call tries again. */
  | ({ readonly kind: "failed"; readonly failure: TaskFailure } & Approval)
  /** At the end, explained, with the level the published rule gave. */
  | { readonly kind: "explained"; readonly result: number };

/** The diagnostic after a turn: its progress, to save in the session record, and where it paused. */
export interface AiLedOutcome {
  /** The progress after the turn, for the session record. */
  readonly progress: AiLedProgress;
  /** Where it paused. */
  readonly pause: AiLedPause;
  /** The record of each call made this turn, answered or not, for the activity log (MVP S17.1). */
  readonly calls: readonly CallRecord[];
  /**
   * A multiple-choice question dropped unmarked because its item changed in the bank since it was posed, so the
   * screen can say why the person's answer wasn't marked.
   */
  readonly dropped?: AiLedItem;
}

/** Why a turn's answer wasn't taken. */
export type AiLedTurnError =
  | { readonly kind: "nothing-posed" }
  | { readonly kind: "already-answered" }
  | { readonly kind: "not-an-option"; readonly answer: number | string }
  | { readonly kind: "blank-answer" };

/**
 * Takes one turn of an AI-led diagnostic: rebuilds the graph from its progress, adds the person's answer or
 * approval, and runs it to its next pause (MVP S23.2, S23.5).
 *
 * @remarks Every question is chosen or written through `write-diagnostic-item@1` at the level the published rule
 * sets, from the skill's bank items at that level the session hasn't asked. A bank item's multiple-choice answer is
 * marked by the bank's key with no AI call; any other answer through `mark-diagnostic-answer@1`. When the rule ends
 * the diagnostic, `explain-diagnostic@1` explains the level the rule gave, and never sets it. A call runs only when
 * the turn approves exactly the request shown for it, to the same model. A failed call leaves the progress as it
 * was. A multiple-choice item that changed in the bank since it was posed is dropped and another chosen, never
 * marked by a key the person didn't see. Nothing is written here: the caller saves the progress and logs the calls.
 * @param progress - The diagnostic's progress, as its session record holds it.
 * @param turn - What the person did: an answer, an approval, or nothing, to see where it is.
 * @param context - The model, the skill, the bank and the material.
 * @returns The new progress, where it paused and the calls made, or why the answer wasn't taken.
 * @throws Error when a task's input can't be built from the progress and context, or when the graph stops with no
 * pause and no explanation; both are bugs, in the caller or in how LangGraph reports a pause.
 */
export async function advanceAiLed(
  progress: AiLedProgress,
  turn: AiLedTurn,
  context: AiLedContext,
): Promise<Result<AiLedOutcome, AiLedTurnError>> {
  const answer = checkAnswer(progress, turn.answer);
  if (!answer.ok) return answer;
  const run: Run = {
    context,
    model: modelName(context.provider, context.model),
    approved: turn.approve === undefined ? undefined : approvalKey(turn.approve),
    calls: [],
  };
  const graph = buildGraph(run);
  const config = { configurable: { thread_id: "ai-led-diagnostic" } };
  await graph.updateState(
    config,
    { ...toState(progress), ...(answer.value !== undefined && { answer: answer.value }) },
    "route",
  );
  await graph.invoke(null, config);
  const next = fromState((await graph.getState(config)).values as GraphState);
  const pause =
    run.pause ??
    (next.explanation === undefined
      ? undefined
      : { kind: "explained", result: diagnosticResult(next.steps) });
  if (pause === undefined) throw new Error("The diagnostic stopped with no pause and no explanation.");
  return ok({
    progress: next,
    pause,
    calls: run.calls,
    ...(run.dropped !== undefined && { dropped: run.dropped }),
  });
}

// An answer the posed question can take: an option's index for multiple choice, text for anything else.
function checkAnswer(
  progress: AiLedProgress,
  answer: number | string | undefined,
): Result<number | string | undefined, AiLedTurnError> {
  if (answer === undefined) return ok(undefined);
  const { posed } = progress;
  if (posed === undefined) return err({ kind: "nothing-posed" });
  if (progress.answer !== undefined) return err({ kind: "already-answered" });
  if (posed.format === "mcq")
    return typeof answer === "number" &&
      Number.isInteger(answer) &&
      answer >= 0 &&
      answer < posed.options.length
      ? ok(answer)
      : err({ kind: "not-an-option", answer });
  return typeof answer === "string" && /\S/.test(answer) ? ok(answer) : err({ kind: "blank-answer" });
}

// What makes two calls the same call: exactly what they send, and the model they go to.
const approvalKey = ({ call, model }: Approval): string => JSON.stringify([model, call.request]);

// One turn's own memory, kept out of the graph's checkpoint: the approval it carries, the pause it reached, the
// calls it made and a question it dropped.
interface Run {
  readonly context: AiLedContext;
  readonly model: string;
  approved: string | undefined;
  pause?: AiLedPause;
  readonly calls: CallRecord[];
  dropped?: AiLedItem;
}

// Pauses the graph; what it paused for is kept in the turn's memory, not in the interrupt.
function pauseFor(run: Run, pause: AiLedPause): never {
  run.pause = pause;
  throw new NodeInterrupt(pause.kind);
}

// The graph's state: the progress, with `null` for what isn't there.
const State = Annotation.Root({
  start: Annotation<number>(),
  steps: Annotation<readonly AiLedStep[]>(),
  posed: Annotation<AiLedItem | null>(),
  answer: Annotation<number | string | null>(),
  explanation: Annotation<HeldExplanation | null>(),
});

type GraphState = typeof State.State;

const toState = (progress: AiLedProgress): GraphState => ({
  start: progress.start,
  steps: progress.steps,
  posed: progress.posed ?? null,
  answer: progress.answer ?? null,
  explanation: progress.explanation ?? null,
});

function fromState(state: GraphState): AiLedProgress {
  return {
    start: state.start,
    steps: state.steps,
    ...(state.posed !== null && { posed: state.posed }),
    // Only text waits to be marked: a multiple-choice answer is marked as it comes.
    ...(typeof state.answer === "string" && { answer: state.answer }),
    ...(state.explanation !== null && { explanation: state.explanation }),
  };
}

function buildGraph(run: Run) {
  return new StateGraph(State)
    .addNode("route", () => ({}))
    .addNode("ask", (state) => {
      if (state.posed === null) throw new Error("Asked with nothing posed.");
      return pauseFor(run, { kind: "answer", posed: state.posed });
    })
    .addNode("choose", (state) => choose(state, run))
    .addNode("mark", (state) => mark(state, run))
    .addNode("explain", (state) => explain(state, run))
    .addEdge(START, "route")
    .addConditionalEdges("route", (state) => {
      if (state.explanation !== null) return END;
      if (state.posed !== null) return state.answer === null ? "ask" : "mark";
      return nextLevel(state.start, state.steps).kind === "end" ? "explain" : "choose";
    })
    .addEdge("choose", "route")
    .addEdge("mark", "route")
    .addEdge("explain", END)
    .compile({ checkpointer: new MemorySaver() });
}

// Runs a call the person approved, once, or pauses to show it; a failed call pauses with why.
async function approved<I, O>(
  run: Run,
  task: Task<I, O>,
  input: NoInfer<I>,
): Promise<{ readonly output: O; readonly ai: AiProvenance }> {
  const approval = { call: prepareCall(task, input), model: run.model };
  const key = approvalKey(approval);
  if (run.approved !== key)
    return pauseFor(run, { kind: "approve", stale: run.approved !== undefined, ...approval });
  // An approval is spent by the call it approved, so nothing else in the turn can use it.
  run.approved = undefined;
  const answer = await runTask(run.context.provider, task, input, run.context);
  run.calls.push(answer.ok ? answer.value.call : answer.error.call);
  if (!answer.ok) return pauseFor(run, { kind: "failed", failure: answer.error, ...approval });
  return answer.value;
}

// The questions so far, as the tasks read them: each answer as its text.
function answered(steps: readonly AiLedStep[]): z.input<typeof AnsweredQuestion>[] {
  return steps.map((step) =>
    step.format === "mcq"
      ? {
          format: step.format,
          level: step.level,
          prompt: step.prompt,
          answer: step.options[step.answer] ?? "",
          correct: step.correct,
        }
      : {
          format: step.format,
          level: step.level,
          prompt: step.prompt,
          answer: step.answer,
          correct: step.correct,
          reasons: step.reasons,
        },
  );
}

// The skill's bank items.
const skillBank = (context: AiLedContext): AssessmentItem[] =>
  context.bank.filter((item) => item.skills[0] === context.slug);

async function choose(state: GraphState, run: Run): Promise<Partial<GraphState>> {
  const { context } = run;
  const next = nextLevel(state.start, state.steps);
  if (next.kind === "end") throw new Error("Chose a question after the end.");
  const asked = new Set(state.steps.map((step) => step.item));
  const offered = skillBank(context).filter((item) => item.level === next.level && !asked.has(item.slug));
  const { output, ai } = await approved(run, writeDiagnosticItem, {
    skill: context.skill,
    level: next.level,
    scale: context.scale,
    bank: offered.map(({ slug, format, prompt }) => ({ slug, format, prompt })),
    material: context.material,
    steps: answered(state.steps),
  });
  const chosen = { level: next.level, chosen: ai, why: output.why };
  // The task's check has made sure a bank choice names an item offered and a written one has its text.
  if (output.source === "written")
    return {
      posed: {
        ...chosen,
        source: "written",
        format: output.format ?? "open",
        prompt: output.prompt ?? "",
        rubric: output.rubric ?? "",
      },
    };
  const item = offered.find((one) => one.slug === output.bank);
  if (item === undefined) throw new Error("The model chose a bank item it wasn't offered.");
  return {
    posed:
      item.format === "mcq"
        ? {
            ...chosen,
            source: "bank",
            item: item.slug,
            format: "mcq",
            prompt: item.prompt,
            options: item.options,
          }
        : {
            ...chosen,
            source: "bank",
            item: item.slug,
            format: item.format,
            prompt: item.prompt,
            rubric: item.rubric,
          },
  };
}

async function mark(state: GraphState, run: Run): Promise<Partial<GraphState>> {
  const { context } = run;
  const { posed, answer } = state;
  if (posed === null || answer === null) throw new Error("Marked with nothing answered.");
  if (posed.format === "mcq") {
    const item = skillBank(context).find((one) => one.slug === posed.item);
    // The item changed in the bank since it was posed: ask another rather than mark by a key the person never saw.
    const same =
      item?.format === "mcq" &&
      item.level === posed.level &&
      item.prompt === posed.prompt &&
      JSON.stringify(item.options) === JSON.stringify(posed.options);
    if (!same) {
      run.dropped = posed;
      return { posed: null, answer: null };
    }
    const choice = Number(answer);
    return {
      steps: [...state.steps, { ...posed, answer: choice, correct: choice === item.answer }],
      posed: null,
      answer: null,
    };
  }
  const text = String(answer);
  const { output, ai } = await approved(run, markDiagnosticAnswer, {
    skill: context.skill,
    level: posed.level,
    scale: context.scale,
    item: { format: posed.format, prompt: posed.prompt, rubric: posed.rubric },
    answer: text,
  });
  const step: AiLedStep = {
    ...posed,
    answer: text,
    correct: output.correct,
    reasons: output.reasons,
    marked: ai,
  };
  return { steps: [...state.steps, step], posed: null, answer: null };
}

async function explain(state: GraphState, run: Run): Promise<Partial<GraphState>> {
  const { context } = run;
  const { output, ai } = await approved(run, explainDiagnostic, {
    skill: context.skill,
    scale: context.scale,
    start: state.start,
    result: diagnosticResult(state.steps),
    rule: QUESTION_BANK_RULE,
    material: context.material,
    steps: answered(state.steps),
  });
  return { explanation: { ...output, ai } };
}
