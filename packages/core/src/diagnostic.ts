/**
 * The question-bank diagnostic's published rule: which question comes next, when it ends, and the level it gives
 * (MVP S19.3, S19.4, PRD E1, E2).
 *
 * @remarks Pure functions with no AI and no storage, so the rule is the same wherever it runs and can be published
 * as written here. The level rests only on the answers given in the session; claims and evidence play no part in
 * it (PRD E4, ADR-0019). Nothing is scored: the result is a level on the scale, explained by the path taken
 * (Charter R1).
 * @packageDocumentation
 */
import type { AssessmentItem, McqItem } from "./schemas/assessment-item.ts";
import type { DiagnosticStep } from "./schemas/evidence.ts";

export type { DiagnosticStep } from "./schemas/evidence.ts";

/** The workflow a question-bank diagnostic's session names (data model §10). */
export const QUESTION_BANK_WORKFLOW = "question-bank@1";

/** The name of the published rule, recorded with every result so it can be checked later (PRD E2). */
export const QUESTION_BANK_RULE = "two-right-to-settle@1";

/** The workflow an AI-led diagnostic's session names (data model §10, MVP S23). */
export const AI_LED_WORKFLOW = "ai-led-diagnostic@1";

/** The most questions one diagnostic asks (MVP S19.3, S23.2). */
export const MAX_QUESTIONS = 12;

/**
 * One answered question as the rule reads it: its level and whether it was marked right.
 *
 * @remarks A question-bank step and an AI-led step both carry these, so one rule settles both (ADR-0019).
 */
export type Marking = Pick<DiagnosticStep, "level" | "correct">;

/** What comes next: a question, or the end with its level. */
export type NextQuestion =
  { readonly kind: "ask"; readonly item: McqItem } | { readonly kind: "end"; readonly result: number };

/** What comes next by the rule alone: a question at a level, or the end with its level. */
export type NextLevel =
  { readonly kind: "ask"; readonly level: number } | { readonly kind: "end"; readonly result: number };

/**
 * The level the diagnostic gives: the highest level with two answers right, or 0 (MVP S19.4, S23.3).
 *
 * @param steps - The questions asked and marked so far.
 * @returns A level from 0 to 4.
 */
export function diagnosticResult(steps: readonly Marking[]): number {
  const levels = [0, 1, 2, 3, 4].filter((level) => right(steps, level) >= 2);
  return levels.at(-1) ?? 0;
}

/**
 * The level the next question is at, or the end, by the published rule and nothing else (MVP S19.3, S23.2).
 *
 * @remarks The first question is at the starting level; after a right marking the next is a level up, after a wrong
 * one a level down, within 0–4. It ends when the level is settled or after {@link MAX_QUESTIONS} questions. An
 * AI-led diagnostic can always write a question, so it never ends for want of one, as a question bank can.
 * @param start - The level the diagnostic started at.
 * @param steps - The questions asked and marked so far.
 * @returns The next question's level, or the end with its level.
 */
export function nextLevel(start: number, steps: readonly Marking[]): NextLevel {
  if (steps.length >= MAX_QUESTIONS || settled(steps))
    return { kind: "end", result: diagnosticResult(steps) };
  const last = steps.at(-1);
  const level = last === undefined ? start : Math.max(0, Math.min(4, last.level + (last.correct ? 1 : -1)));
  return { kind: "ask", level };
}

/**
 * Chooses the next question, or ends the diagnostic, by the published rule (MVP S19.3).
 *
 * @remarks The first question is at the starting level. After a right answer the next is a level up, after a wrong
 * one a level down, within 0–4. The diagnostic ends when the level is settled: two answers right at a level and
 * two wrong at the level above (or that level is 4), or two wrong at level 0. It also ends when the bank has no
 * item left at the level needed, or after {@link MAX_QUESTIONS} questions. An item is never asked twice in one
 * session, and items not seen in an earlier attempt come first (S19.7).
 * @param bank - The pack's assessment items.
 * @param skill - The skill being tested.
 * @param start - The level the diagnostic started at.
 * @param steps - The questions asked and answered so far.
 * @param seen - The items asked in earlier attempts at this skill.
 * @param random - A number from 0 up to 1, to choose among the items that qualify.
 * @returns The next question, or the end with its level.
 */
export function nextQuestion(
  bank: readonly AssessmentItem[],
  skill: string,
  start: number,
  steps: readonly DiagnosticStep[],
  seen: ReadonlySet<string>,
  random: () => number,
): NextQuestion {
  const next = nextLevel(start, steps);
  if (next.kind === "end") return next;
  const { level } = next;
  const end = { kind: "end", result: diagnosticResult(steps) } as const;
  const asked = new Set(steps.map((step) => step.item));
  const candidates = bank.filter(
    (item): item is McqItem =>
      item.format === "mcq" && item.skills[0] === skill && item.level === level && !asked.has(item.slug),
  );
  const fresh = candidates.filter((item) => !seen.has(item.slug));
  const pool = fresh.length > 0 ? fresh : candidates;
  // A number outside 0 up to 1, as a faulty source could give, chooses the first rather than ending early.
  const unit = random();
  const index =
    Number.isFinite(unit) && unit >= 0 ? Math.min(pool.length - 1, Math.floor(unit * pool.length)) : 0;
  const item = pool[index];
  return item === undefined ? end : { kind: "ask", item };
}

// Whether the level is settled: two right at a level and two wrong above it (or it is the top), or two wrong at 0.
function settled(steps: readonly Marking[]): boolean {
  if (wrong(steps, 0) >= 2) return true;
  return [0, 1, 2, 3, 4].some(
    (level) => right(steps, level) >= 2 && (level === 4 || wrong(steps, level + 1) >= 2),
  );
}

const right = (steps: readonly Marking[], level: number): number =>
  steps.filter((step) => step.level === level && step.correct).length;

const wrong = (steps: readonly Marking[], level: number): number =>
  steps.filter((step) => step.level === level && !step.correct).length;
