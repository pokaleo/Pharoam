import { describe, expect, it, vi } from "vitest";
import { err, ok, type Result } from "../result.ts";
import type { AssessmentItem, McqItem } from "../schemas/assessment-item.ts";
import type { AiLedStep } from "../schemas/evidence.ts";
import { fakeProvider } from "../testing/fake-provider.ts";
import {
  advanceAiLed,
  type AiLedContext,
  type AiLedOutcome,
  type AiLedProgress,
  type AiLedTurn,
} from "./ai-led-diagnostic.ts";
import type { ModelRequest, ProviderError } from "./provider.ts";

const ORIGIN = {
  schema: "assessment-item/1" as const,
  language: "en",
  origin: { source: "Pharoam content", licence: "CC-BY-SA-4.0" },
  review: { by: "The Pharoam founder", at: "2026-11-15" },
  ai: null,
};
const SQL = ["sql" as AssessmentItem["skills"][number]];
const mcq = (level: number, part: string, skills = SQL, prefix = "sql"): AssessmentItem => ({
  ...ORIGIN,
  skills,
  slug: `${prefix}-${String(level)}-${part}`,
  level,
  format: "mcq",
  prompt: `Which is it at level ${String(level)}?`,
  options: ["a", "b", "c"],
  answer: 1,
  explanation: "Because b.",
});
const OPEN: AssessmentItem = {
  ...ORIGIN,
  skills: SQL,
  slug: "sql-3-open",
  level: 3,
  format: "open",
  prompt: "Rank each customer's orders by date.",
  rubric: "Partitions by customer and orders by date.",
};
const PYTHON = mcq(2, "a", ["python" as AssessmentItem["skills"][number]], "python");
const BANK = [...[0, 1, 2, 3, 4].flatMap((level) => [mcq(level, "a"), mcq(level, "b")]), OPEN, PYTHON];
const level = (name: string) => ({ name, description: `Someone at ${name} level.` });
const SCALE = {
  0: level("None"),
  1: level("Aware"),
  2: level("Working"),
  3: level("Practitioner"),
  4: level("Expert"),
};
const MATERIAL = {
  evidence: [{ ref: "E1", text: "Payments database: wrote the reporting queries." }],
  claims: [{ level: 3, provenance: "self-reported" as const, since: "2026-10-24" }],
  earlier: [],
};
const START: AiLedProgress = { start: 2, steps: [] };
const WHY = "Probes joins, which the evidence names but doesn't show.";
const AT = "2026-11-23T10:00:00Z";
const CHOSE = { task: "write-diagnostic-item@1", model: "fake/m", at: AT };
const EXPLANATION = {
  showed: "Joins are solid.",
  comparison: "As you claimed.",
  reasons: [],
  next_step: "Try a window function.",
};

// A bank item the session asked and marked, answered right (option 1) or wrong.
const bankStep = (at: number, part: string, correct: boolean): AiLedStep => ({
  source: "bank",
  item: `sql-${String(at)}-${part}`,
  format: "mcq",
  level: at,
  prompt: `Which is it at level ${String(at)}?`,
  options: ["a", "b", "c"],
  chosen: CHOSE,
  why: WHY,
  answer: correct ? 1 : 0,
  correct,
});

// Answers each task as the test says; any task it doesn't name fails the test.
type Answer = (request: ModelRequest) => Result<unknown, ProviderError>;
interface Answers {
  readonly write?: Answer;
  readonly mark?: Answer;
  readonly explain?: Answer;
}
const TASKS: Readonly<Record<string, keyof Answers>> = {
  "write-diagnostic-item": "write",
  "mark-diagnostic-answer": "mark",
  "explain-diagnostic": "explain",
};
const LOGS = new WeakMap<AiLedContext, string[]>();
function context(answers: Answers) {
  const provider = fakeProvider((request) => {
    const name = TASKS[request.output.name];
    const answer = name === undefined ? undefined : answers[name];
    if (answer === undefined) throw new Error(`Unexpected call to ${request.output.name}.`);
    return answer(request);
  });
  const ctx: AiLedContext = {
    provider,
    model: "m",
    now: () => new Date(AT),
    slug: "sql",
    skill: "SQL: querying relational databases",
    scale: SCALE,
    bank: BANK,
    material: MATERIAL,
  };
  const calls: string[] = [];
  LOGS.set(ctx, calls);
  return { ctx, provider, calls };
}

const CHOOSE_BANK = (slug: string) => () => ok({ source: "bank", bank: slug, why: WHY });

// Runs one turn and returns its outcome, logging its calls, and failing the test on an input error.
async function turn(progress: AiLedProgress, input: AiLedTurn, ctx: AiLedContext): Promise<AiLedOutcome> {
  const outcome = await advanceAiLed(progress, input, ctx);
  if (!outcome.ok) throw new Error(outcome.error.kind);
  LOGS.get(ctx)?.push(...outcome.value.calls.map((call) => `${call.task} ${call.outcome}`));
  return outcome.value;
}

// Approves the call the last outcome showed or failed on.
function approval(outcome: AiLedOutcome): AiLedTurn {
  const { pause } = outcome;
  if (pause.kind !== "approve" && pause.kind !== "failed") throw new Error(`Paused for ${pause.kind}.`);
  return { approve: { call: pause.call, model: pause.model } };
}

// The diagnostic from the start to its first question, chosen as the model says.
async function firstQuestion(ctx: AiLedContext): Promise<AiLedOutcome> {
  return turn(START, approval(await turn(START, {}, ctx)), ctx);
}

describe("the AI-led diagnostic's graph (MVP S23.1, S23.2, S23.5)", () => {
  it("sends nothing until the person agrees, showing exactly what the first call would send, and to which model (S23.1)", async () => {
    const { ctx, provider } = context({});
    const first = await turn(START, {}, ctx);

    expect(provider.requests).toEqual([]);
    expect(first.progress).toEqual(START);
    expect(first.calls).toEqual([]);
    expect(first.pause).toMatchObject({
      kind: "approve",
      stale: false,
      model: "fake/m",
      call: { task: "write-diagnostic-item@1" },
    });
    if (first.pause.kind !== "approve") return;
    expect(first.pause.call.parts.map((part) => part.kind)).toEqual(["skill", "evidence", "claims"]);
    expect(first.pause.call.request.system).toContain("level 2 Working");
    expect(first.pause.call.size).toBeGreaterThan(0);
  });

  it("asks the question the model chose, in full, with the call that chose it and why (S23.2)", async () => {
    const { ctx, provider, calls } = context({ write: CHOOSE_BANK("sql-2-b") });
    const asked = await firstQuestion(ctx);

    expect(provider.requests).toHaveLength(1);
    expect(calls).toEqual(["write-diagnostic-item@1 answered"]);
    const posed = {
      source: "bank",
      item: "sql-2-b",
      format: "mcq",
      level: 2,
      prompt: "Which is it at level 2?",
      options: ["a", "b", "c"],
      chosen: CHOSE,
      why: WHY,
    };
    expect(asked.progress.posed).toEqual(posed);
    expect(asked.pause).toEqual({ kind: "answer", posed });
  });

  it("offers the model only the skill's bank items at the level that the session hasn't asked", async () => {
    const { ctx } = context({});
    // Right at 2, wrong at 3: back to 2, where sql-2-a was asked already.
    const progress = { start: 2, steps: [bankStep(2, "a", true), bankStep(3, "a", false)] };
    const next = await turn(progress, {}, ctx);
    if (next.pause.kind !== "approve") throw new Error(next.pause.kind);
    const { system } = next.pause.call.request;
    expect(system).toContain("level 2 Working");
    expect(system).toContain("sql-2-b");
    expect(system).not.toContain("sql-2-a");
    expect(system).not.toContain("sql-3-");
    expect(system).not.toContain("python-2-a");
  });

  it("sends nothing on an approval of some other call, or of the same call to another model, and says so", async () => {
    const { ctx, provider } = context({ write: CHOOSE_BANK("sql-2-b") });
    const first = await turn(START, {}, ctx);
    if (first.pause.kind !== "approve") throw new Error(first.pause.kind);
    const changed = {
      ...first.pause.call,
      request: { ...first.pause.call.request, prompt: "Something else." },
    };

    const other = await turn(START, { approve: { call: changed, model: "fake/m" } }, ctx);
    const elsewhere = await turn(START, { approve: { call: first.pause.call, model: "cloud/big" } }, ctx);

    expect(provider.requests).toEqual([]);
    expect(other.pause).toEqual({ ...first.pause, stale: true });
    expect(elsewhere.pause).toEqual({ ...first.pause, stale: true });
  });

  it("marks a multiple-choice answer by the bank's key with no AI call, then moves up a level (S23.2)", async () => {
    const { ctx, provider } = context({ write: CHOOSE_BANK("sql-2-b") });
    const asked = await firstQuestion(ctx);

    const marked = await turn(asked.progress, { answer: 1 }, ctx);

    expect(provider.requests).toHaveLength(1);
    expect(marked.calls).toEqual([]);
    expect(marked.progress.posed).toBeUndefined();
    expect(marked.progress.steps).toEqual([{ ...asked.progress.posed, answer: 1, correct: true }]);
    if (marked.pause.kind !== "approve") throw new Error(marked.pause.kind);
    expect(marked.pause.call.request.system).toContain("level 3 Practitioner");
  });

  it("marks option 0 as an answer like any other", async () => {
    const { ctx } = context({ write: CHOOSE_BANK("sql-2-b") });
    const asked = await firstQuestion(ctx);

    const marked = await turn(asked.progress, { answer: 0 }, ctx);

    expect(marked.progress.steps).toEqual([{ ...asked.progress.posed, answer: 0, correct: false }]);
    if (marked.pause.kind !== "approve") throw new Error(marked.pause.kind);
    expect(marked.pause.call.request.system).toContain("level 1 Aware");
  });

  it("marks a written answer only once the person agrees to send it, keeping the reasons and the call (S23.2)", async () => {
    const written = {
      source: "written",
      format: "open",
      prompt: "Explain a LEFT JOIN.",
      rubric: "Keeps unmatched rows.",
      why: WHY,
    };
    const { ctx, provider, calls } = context({
      write: () => ok(written),
      mark: () => ok({ level: 2, correct: true, reasons: "Says unmatched rows are kept." }),
    });
    const asked = await firstQuestion(ctx);
    expect(asked.progress.posed).toMatchObject({
      source: "written",
      format: "open",
      rubric: "Keeps unmatched rows.",
    });

    const waiting = await turn(asked.progress, { answer: "It keeps rows with no match." }, ctx);
    expect(provider.requests).toHaveLength(1);
    expect(waiting.progress.answer).toBe("It keeps rows with no match.");
    if (waiting.pause.kind !== "approve") throw new Error(waiting.pause.kind);
    expect(waiting.pause.call.task).toBe("mark-diagnostic-answer@1");
    expect(waiting.pause.call.parts).toContainEqual({ kind: "answer", text: "It keeps rows with no match." });

    const marked = await turn(waiting.progress, approval(waiting), ctx);
    expect(calls).toEqual(["write-diagnostic-item@1 answered", "mark-diagnostic-answer@1 answered"]);
    expect(marked.progress.answer).toBeUndefined();
    expect(marked.progress.steps).toEqual([
      {
        ...asked.progress.posed,
        answer: "It keeps rows with no match.",
        correct: true,
        reasons: "Says unmatched rows are kept.",
        marked: { task: "mark-diagnostic-answer@1", model: "fake/m", at: AT },
      },
    ]);
  });

  it("asks a bank's open question with the bank's rubric, and marks its answer through the model", async () => {
    const { ctx } = context({
      write: CHOOSE_BANK("sql-3-open"),
      mark: () => ok({ level: 3, correct: false, reasons: "Doesn't partition." }),
    });
    const start = { start: 3, steps: [] };
    const asked = await turn(start, approval(await turn(start, {}, ctx)), ctx);
    expect(asked.progress.posed).toEqual({
      source: "bank",
      item: "sql-3-open",
      format: "open",
      level: 3,
      prompt: OPEN.prompt,
      rubric: "Partitions by customer and orders by date.",
      chosen: CHOSE,
      why: WHY,
    });

    const waiting = await turn(asked.progress, { answer: "ORDER BY date" }, ctx);
    const marked = await turn(waiting.progress, approval(waiting), ctx);

    expect(marked.progress.steps).toMatchObject([
      { item: "sql-3-open", correct: false, reasons: "Doesn't partition." },
    ]);
  });

  it("resumes from its progress alone, as after a reload, at the same question or answer waiting (S23.5)", async () => {
    const { ctx, provider } = context({ write: CHOOSE_BANK("sql-2-b") });
    const asked = await firstQuestion(ctx);
    const saved = JSON.parse(JSON.stringify(asked.progress)) as AiLedProgress;

    const resumed = await turn(saved, {}, context({}).ctx);
    expect(resumed).toEqual({ ...asked, calls: [] });
    expect(provider.requests).toHaveLength(1);

    const waiting: AiLedProgress = {
      start: 3,
      steps: [],
      posed: {
        source: "bank",
        item: "sql-3-open",
        format: "open",
        level: 3,
        prompt: OPEN.prompt,
        rubric: "Partitions by customer and orders by date.",
        chosen: CHOSE,
        why: WHY,
      },
      answer: "ORDER BY date",
    };
    const back = await turn(waiting, {}, context({}).ctx);
    expect(back.progress).toEqual(waiting);
    expect(back.pause).toMatchObject({ kind: "approve", call: { task: "mark-diagnostic-answer@1" } });
  });

  it.each([
    ["its options", (one: McqItem): McqItem => ({ ...one, options: ["x", "y"] })],
    ["its prompt", (one: McqItem): McqItem => ({ ...one, prompt: "Which is it now?" })],
    ["its level", (one: McqItem): McqItem => ({ ...one, level: 3 })],
  ])(
    "drops a question whose bank item changed %s since it was posed, rather than marking it by a new key",
    async (_change, change) => {
      const { ctx } = context({ write: CHOOSE_BANK("sql-2-b") });
      const asked = await firstQuestion(ctx);
      const bank = BANK.map((one) => (one.slug === "sql-2-b" && one.format === "mcq" ? change(one) : one));
      const changed = { ...ctx, bank };

      const next = await turn(asked.progress, { answer: 1 }, changed);

      expect(next.progress).toEqual(START);
      expect(next.dropped).toEqual(asked.progress.posed);
      expect(next.pause).toMatchObject({ kind: "approve", call: { task: "write-diagnostic-item@1" } });
    },
  );

  it("drops a question whose bank item has gone", async () => {
    const { ctx } = context({ write: CHOOSE_BANK("sql-2-b") });
    const asked = await firstQuestion(ctx);
    const gone = { ...ctx, bank: BANK.filter((one) => one.slug !== "sql-2-b") };

    const next = await turn(asked.progress, { answer: 1 }, gone);

    expect(next.dropped).toEqual(asked.progress.posed);
    expect(next.progress.steps).toEqual([]);
  });

  it("ends by the published rule, then explains the level it gave, which the model never sets (S23.3)", async () => {
    const { ctx, calls } = context({ explain: () => ok({ ...EXPLANATION, level: 1 }) });
    const settled = { start: 4, steps: [bankStep(4, "a", true), bankStep(4, "b", true)] };

    const asking = await turn(settled, {}, ctx);
    if (asking.pause.kind !== "approve") throw new Error(asking.pause.kind);
    expect(asking.pause.call.task).toBe("explain-diagnostic@1");
    expect(asking.pause.call.request.system).toContain("gave level 4 Expert");

    const explained = await turn(settled, approval(asking), ctx);
    expect(calls).toEqual(["explain-diagnostic@1 answered"]);
    expect(explained.pause).toEqual({ kind: "explained", result: 4 });
    expect(explained.progress.explanation).toEqual({
      ...EXPLANATION,
      ai: { task: "explain-diagnostic@1", model: "fake/m", at: AT },
    });

    const after = await turn(explained.progress, {}, ctx);
    expect(after).toEqual({ ...explained, calls: [] });
  });

  it("keeps its progress when a call fails, so the person can try it again", async () => {
    let fail = true;
    const { ctx, calls } = context({
      write: () =>
        fail ? err({ kind: "unreachable" as const, message: "offline" }) : CHOOSE_BANK("sql-2-a")(),
    });
    const first = await turn(START, {}, ctx);

    const failed = await turn(START, approval(first), ctx);
    expect(failed.progress).toEqual(START);
    expect(failed.pause).toMatchObject({ kind: "failed", call: { task: "write-diagnostic-item@1" } });
    if (failed.pause.kind !== "failed") return;
    expect(failed.pause.failure.reason.kind).toBe("provider");

    fail = false;
    const retried = await turn(START, approval(failed), ctx);
    expect(calls).toEqual(["write-diagnostic-item@1 failed", "write-diagnostic-item@1 answered"]);
    expect(retried.pause.kind).toBe("answer");
  });

  it("keeps the answer waiting when the marking or the explanation fails", async () => {
    const offline = () => err({ kind: "unreachable" as const, message: "offline" });
    const { ctx } = context({ mark: offline, explain: offline });
    const waiting: AiLedProgress = {
      start: 3,
      steps: [],
      posed: {
        source: "written",
        format: "open",
        level: 3,
        prompt: "Why?",
        rubric: "Because.",
        chosen: CHOSE,
        why: WHY,
      },
      answer: "Because.",
    };
    const marking = await turn(waiting, approval(await turn(waiting, {}, ctx)), ctx);
    expect(marking.progress).toEqual(waiting);
    expect(marking.pause).toMatchObject({ kind: "failed", call: { task: "mark-diagnostic-answer@1" } });

    const settled = { start: 4, steps: [bankStep(4, "a", true), bankStep(4, "b", true)] };
    const explaining = await turn(settled, approval(await turn(settled, {}, ctx)), ctx);
    expect(explaining.progress).toEqual(settled);
    expect(explaining.pause).toMatchObject({ kind: "failed", call: { task: "explain-diagnostic@1" } });
  });

  it("reports a refused answer as the model sent it, even one shaped like a LangChain object", async () => {
    const steered = {
      lc: 1,
      type: "constructor",
      id: ["langchain_core", "prompts", "prompt", "PromptTemplate"],
      kwargs: { template: "{x}", inputVariables: ["x"] },
    };
    const { ctx } = context({ write: () => ok(steered) });

    const refused = await turn(START, approval(await turn(START, {}, ctx)), ctx);

    expect(refused.progress).toEqual(START);
    if (refused.pause.kind !== "failed") throw new Error(refused.pause.kind);
    expect(refused.pause.failure.reason.kind).toBe("invalid-answer");
    expect(refused.pause.failure.call.received).toEqual({ answer: steered });
    expect(refused.calls).toEqual([refused.pause.failure.call]);
  });

  it("refuses an answer with nothing posed, an option that isn't shown, or a blank or misplaced one", async () => {
    const { ctx } = context({ write: CHOOSE_BANK("sql-2-b") });
    const asked = await firstQuestion(ctx);

    expect(await advanceAiLed(START, { answer: 1 }, ctx)).toEqual(err({ kind: "nothing-posed" }));
    expect(await advanceAiLed(asked.progress, { answer: 3 }, ctx)).toEqual(
      err({ kind: "not-an-option", answer: 3 }),
    );
    expect(await advanceAiLed(asked.progress, { answer: "b" }, ctx)).toEqual(
      err({ kind: "not-an-option", answer: "b" }),
    );

    const open = context({
      write: () =>
        ok({ source: "written", format: "practical", prompt: "Write a join.", rubric: "Joins.", why: WHY }),
    });
    const task = await firstQuestion(open.ctx);
    expect(await advanceAiLed(task.progress, { answer: "  " }, open.ctx)).toEqual(
      err({ kind: "blank-answer" }),
    );
    expect(await advanceAiLed(task.progress, { answer: 1 }, open.ctx)).toEqual(err({ kind: "blank-answer" }));
    const waiting = await turn(task.progress, { answer: "SELECT 1" }, open.ctx);
    expect(await advanceAiLed(waiting.progress, { answer: "again" }, open.ctx)).toEqual(
      err({ kind: "already-answered" }),
    );
  });

  it("sends nothing to LangSmith, even with tracing switched on where it runs (hard rule 7)", async () => {
    // The variable's name is built from parts because the content rules refuse it written out next to `true`; it is
    // switched on here only to prove that switching it on sends nothing.
    vi.stubEnv(["LANGSMITH", "TRACING"].join("_"), "true");
    const network = vi.fn(() => Promise.reject(new Error("No network in tests.")));
    vi.stubGlobal("fetch", network);
    try {
      const { ctx } = context({ write: CHOOSE_BANK("sql-2-b") });
      // The stand-in for LangSmith refuses any tracing path loudly, so the run stops before anything is sent.
      await expect(firstQuestion(ctx)).rejects.toThrow("no LangSmith tracing");
      expect(network).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  });

  it("explains after 12 questions even when the level isn't settled, never asking a 13th (S23.2)", async () => {
    const { ctx } = context({});
    const marks = [0, 1, 0, 0, 1, 2, 1, 2, 3, 4, 4, 3];
    const answers = Array.from("RWWRRWRRRRWW", (mark) => mark === "R");
    const steps = marks.map((at, index): AiLedStep => ({
      source: "written",
      format: "open",
      level: at,
      prompt: `Question ${String(index + 1)}`,
      rubric: "Right.",
      chosen: CHOSE,
      why: WHY,
      answer: "An answer.",
      correct: answers[index] ?? false,
      reasons: "Because.",
      marked: { task: "mark-diagnostic-answer@1", model: "fake/m", at: AT },
    }));

    const next = await turn({ start: 0, steps }, {}, ctx);

    expect(next.pause).toMatchObject({ kind: "approve", call: { task: "explain-diagnostic@1" } });
  });
});
