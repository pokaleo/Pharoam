import { describe, expect, it } from "vitest";
import { MAX_QUESTIONS, diagnosticResult, nextQuestion, type DiagnosticStep } from "./diagnostic.ts";
import type { McqItem } from "./schemas/assessment-item.ts";

// Three items per level for SQL, and one for Python; the right answer is always option 1.
const item = (skill: string, level: number, part: string): McqItem => ({
  schema: "assessment-item/1",
  slug: `${skill}-${String(level)}-${part}`,
  skills: [skill as McqItem["skills"][number]],
  level,
  format: "mcq",
  prompt: "Which is it?",
  options: ["a", "b", "c"],
  answer: 1,
  explanation: "Because b.",
  language: "en",
  origin: { source: "Pharoam content", licence: "CC-BY-SA-4.0" },
  review: { by: "The Pharoam founder", at: "2026-11-15" },
  ai: null,
});
const BANK = [
  ...[0, 1, 2, 3, 4].flatMap((level) => ["a", "b", "c"].map((part) => item("sql", level, part))),
  item("python", 2, "a"),
];
const FIRST = () => 0;

// Plays a diagnostic: each answer is right or wrong in turn, and the next question follows the rule.
function play(start: number, answers: readonly boolean[], seen: ReadonlySet<string> = new Set()) {
  const steps: DiagnosticStep[] = [];
  for (const right of answers) {
    const next = nextQuestion(BANK, "sql", start, steps, seen, FIRST);
    if (next.kind === "end") return { steps, next };
    steps.push({ item: next.item.slug, level: next.item.level, answer: right ? 1 : 0, correct: right });
  }
  return { steps, next: nextQuestion(BANK, "sql", start, steps, seen, FIRST) };
}

describe("the question-bank diagnostic's published rule (MVP S19.3, S19.4)", () => {
  it("starts at the given level, and moves up after a right answer and down after a wrong one", () => {
    const { steps } = play(2, [true, false, false]);
    expect(steps.map((step) => step.level)).toEqual([2, 3, 2]);
  });

  it("ends once two answers are right at a level and two wrong at the level above, with that level", () => {
    const { steps, next } = play(2, [true, false, true, false]);
    expect(steps.map((step) => [step.level, step.correct])).toEqual([
      [2, true],
      [3, false],
      [2, true],
      [3, false],
    ]);
    expect(next).toEqual({ kind: "end", result: 2 });
  });

  it("ends at level 4 after two right answers there, without going past it", () => {
    const { steps, next } = play(2, [true, true, true, true]);
    expect(steps.map((step) => step.level)).toEqual([2, 3, 4, 4]);
    expect(next).toEqual({ kind: "end", result: 4 });
  });

  it("ends at level 0 after two wrong answers there", () => {
    const { steps, next } = play(1, [false, false, false]);
    expect(steps.map((step) => step.level)).toEqual([1, 0, 0]);
    expect(next).toEqual({ kind: "end", result: 0 });
  });

  it("ends when the bank has no item left at the level needed, with the highest level answered right twice", () => {
    // Right, wrong, right, wrong... at levels 2 and 3 until level 3's three items are used.
    const { next } = play(2, [true, false, false, true, false, true, true, true]);
    expect(next.kind).toBe("end");
  });

  it("never asks more than the most questions allowed", () => {
    const alternating = Array.from({ length: 30 }, (_, index) => index % 2 === 0);
    const { steps } = play(2, alternating);
    expect(steps.length).toBeLessThanOrEqual(MAX_QUESTIONS);
  });

  it("gives the highest level answered right twice, or 0, never a score", () => {
    const steps = (pairs: readonly [number, boolean][]): DiagnosticStep[] =>
      pairs.map(([level, correct], index) => ({ item: `i${String(index)}`, level, answer: 0, correct }));
    expect(
      diagnosticResult(
        steps([
          [2, true],
          [3, true],
          [4, false],
          [3, true],
          [4, false],
        ]),
      ),
    ).toBe(3);
    expect(
      diagnosticResult(
        steps([
          [2, true],
          [3, false],
          [2, false],
        ]),
      ),
    ).toBe(0);
    expect(diagnosticResult([])).toBe(0);
  });

  it("asks only the skill's items, never one already asked, and items not seen in an earlier attempt first (S19.7)", () => {
    const seen = new Set(["sql-2-a", "sql-2-b"]);
    const first = nextQuestion(BANK, "sql", 2, [], seen, FIRST);
    expect(first.kind === "ask" && first.item.slug).toBe("sql-2-c");
    const asked = [
      { item: "sql-2-c", level: 2, answer: 0, correct: false },
      { item: "sql-1-a", level: 1, answer: 0, correct: false },
    ];
    const again = nextQuestion(BANK, "sql", 2, asked, new Set(), FIRST);
    expect(again.kind === "ask" && again.item.skills[0]).toBe("sql");
    expect(again.kind === "ask" && again.item.slug).not.toBe("sql-1-a");
  });

  it("chooses among the candidates with the random source it is given", () => {
    const last = () => 0.99;
    const chosen = nextQuestion(BANK, "sql", 2, [], new Set(), last);
    expect(chosen.kind === "ask" && chosen.item.slug).toBe("sql-2-c");
  });
});

describe("the rule's edges (review findings)", () => {
  const step = (level: number, correct: boolean, index: number): DiagnosticStep => ({
    item: `x-${String(index)}`,
    level,
    answer: 0,
    correct,
  });

  it("ends after the most questions allowed, even when the level isn't settled", () => {
    // One right at each level and wrong answers above 0: nothing settles, so only the cap ends it.
    const pairs: [number, boolean][] = [
      [0, true],
      [1, true],
      [2, true],
      [3, true],
      [4, true],
      [1, false],
      [2, false],
      [3, false],
      [4, false],
      [1, false],
      [2, false],
      [3, false],
    ];
    const steps = pairs.map(([level, correct], index) => step(level, correct, index));
    expect(steps).toHaveLength(MAX_QUESTIONS);
    expect(nextQuestion(BANK, "sql", 2, steps, new Set(), FIRST)).toEqual({ kind: "end", result: 0 });
  });

  it("starts at level 0 or 4 when asked, and stays within the scale", () => {
    expect(play(0, [false]).steps.map((one) => one.level)).toEqual([0]);
    expect(play(4, [true, true]).steps.map((one) => one.level)).toEqual([4, 4]);
    expect(play(4, [true, true]).next).toEqual({ kind: "end", result: 4 });
  });

  it("gives the highest level answered right twice when a level runs out of items", () => {
    // Level 2 right twice, then level 3 asked three times, right once and wrong twice: settled at 2.
    const { next } = play(2, [true, false, true, true, false, false]);
    expect(next).toEqual({ kind: "end", result: 2 });
  });

  it("chooses safely whatever number the random source gives", () => {
    for (const odd of [Number.NaN, -1, 1, 5]) {
      const chosen = nextQuestion(BANK, "sql", 2, [], new Set(), () => odd);
      expect(chosen.kind).toBe("ask");
    }
  });
});
