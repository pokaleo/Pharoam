/**
 * Running a registered task: send what was prepared, check the answer, and keep a record of the call.
 *
 * @packageDocumentation
 */
import type { AiProvenance } from "../schemas/fields.ts";
import { err, ok, type Result } from "../result.ts";
import { modelName, type ModelProvider, type ModelRequest, type ProviderError } from "./provider.ts";
import { prepareCall, type Task } from "./task.ts";

/** What one AI call sent and how it ended, for the transparency view (MVP S17.1). */
export interface CallRecord {
  /** The task's name and version. */
  readonly task: string;
  /** The provider and model, as the `ai` block records them. */
  readonly model: string;
  /** When the call was made. */
  readonly at: string;
  /** Exactly what was sent. */
  readonly sent: ModelRequest;
  /**
   * How the call ended: an answer that matched the task's schema, one that didn't, or no answer. Whether the
   * person then accepted or discarded an answer is recorded by the screen that asked them.
   */
  readonly outcome: "answered" | "rejected" | "failed";
}

/** A task's checked answer, ready to show the person. */
export interface TaskAnswer<O> {
  /** The answer, matching the task's output schema. */
  readonly output: O;
  /** The `ai` block for any record written from it, once the person confirms (data model §5). */
  readonly ai: AiProvenance;
  /** The record of the call. */
  readonly call: CallRecord;
}

/** Why a task gave no usable answer. */
export type TaskError =
  | { readonly kind: "provider"; readonly error: ProviderError }
  | { readonly kind: "invalid-answer"; readonly issues: readonly string[] };

/** A task that gave no usable answer, with the record of the call that tried. */
export interface TaskFailure {
  /** Why there is no answer. */
  readonly reason: TaskError;
  /** The record of the call, which the transparency view shows like any other. */
  readonly call: CallRecord;
}

/**
 * Runs a task through a provider and checks the answer against the task's output schema.
 *
 * @remarks The answer is shown to the person only once it matches the schema and the task's own check, so an answer steered by text in the
 * person's material can't take a shape the task doesn't allow (ADR-0004, security §3). Every call, answered or
 * not, comes back with its call record (MVP S17.1). Nothing is written here: records are written only once the
 * person confirms (hard rule 6).
 * @example
 * ```ts
 * const answer = await runTask(provider, normaliseEvidence, { text }, { model, now: () => new Date() });
 * if (answer.ok) showPreview(answer.value.output, answer.value.ai);
 * ```
 * @typeParam I - What the task takes.
 * @typeParam O - What the task's answer holds.
 * @param provider - Where the request goes; its ID is recorded with the model.
 * @param task - The registered task whose prompt and schemas apply.
 * @param input - What the task reads, checked against its input schema first.
 * @param options - The provider's ID for the model, and the clock to time the call by.
 * @returns The checked answer with its `ai` block and call record, or why there is none, with its call record.
 * @throws ZodError when the input doesn't match the task's input schema, which is a bug in the caller.
 */
export async function runTask<I, O>(
  provider: ModelProvider,
  task: Task<I, O>,
  input: I,
  options: { readonly model: string; readonly now: () => Date },
): Promise<Result<TaskAnswer<O>, TaskFailure>> {
  const { request } = prepareCall(task, input);
  // To the second, as Pharoam writes every time, such as `2026-10-24T14:02:11Z` (data model §4–5).
  const at = options
    .now()
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
  const model = modelName(provider, options.model);
  const record = (outcome: CallRecord["outcome"]): CallRecord => ({
    task: task.id,
    model,
    at,
    sent: request,
    outcome,
  });

  const answer = await provider.complete(request, { model: options.model });
  if (!answer.ok) return err({ reason: { kind: "provider", error: answer.error }, call: record("failed") });
  const checked = task.output.safeParse(answer.value);
  if (!checked.success) {
    const issues = checked.error.issues.map(
      (issue) => `${issue.path.map(String).join(".") || "the answer"}: ${issue.message}`,
    );
    return err({ reason: { kind: "invalid-answer", issues }, call: record("rejected") });
  }
  const problems = task.check?.(task.input.parse(input), checked.data) ?? [];
  if (problems.length > 0)
    return err({ reason: { kind: "invalid-answer", issues: problems }, call: record("rejected") });
  return ok({ output: checked.data, ai: { task: task.id, model, at }, call: record("answered") });
}
