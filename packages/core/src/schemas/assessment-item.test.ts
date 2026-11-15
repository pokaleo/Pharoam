import { describe, expect, it } from "vitest";
import { AssessmentItem } from "./assessment-item.ts";

const MCQ = {
  schema: "assessment-item/1",
  slug: "sql-2-joins",
  skills: ["sql"],
  level: 2,
  format: "mcq",
  prompt: "Which join keeps every row of the left table, with nulls where the right has no match?",
  options: ["INNER JOIN", "LEFT JOIN", "CROSS JOIN", "FULL JOIN"],
  answer: 1,
  explanation: "A LEFT JOIN keeps all left rows; INNER drops unmatched rows, CROSS pairs everything.",
  origin: { source: "Pharoam content", licence: "CC-BY-SA-4.0" },
  review: { by: "The Pharoam founder", at: "2026-11-14" },
  ai: { task: "draft-item@1", model: "anthropic/claude-opus-5-5", at: "2026-11-14T10:00:00Z" },
};

describe("the assessment item (data model §11, MVP S20.1)", () => {
  it("reads a multiple-choice item, with English as the default language", () => {
    const item = AssessmentItem.parse(MCQ);
    expect(item).toMatchObject({ ...MCQ, language: "en" });
  });

  it("needs its skill, a level on the scale, a prompt and a review", () => {
    expect(AssessmentItem.safeParse({ ...MCQ, skills: [] }).success).toBe(false);
    expect(AssessmentItem.safeParse({ ...MCQ, level: 5 }).success).toBe(false);
    expect(AssessmentItem.safeParse({ ...MCQ, prompt: " " }).success).toBe(false);
    expect(AssessmentItem.safeParse({ ...MCQ, review: undefined }).success).toBe(false);
  });

  it("needs a multiple-choice item's answer to be one of 2 to 6 options, with an explanation", () => {
    expect(AssessmentItem.safeParse({ ...MCQ, options: ["only one"], answer: 0 }).success).toBe(false);
    expect(AssessmentItem.safeParse({ ...MCQ, options: [...MCQ.options, "e", "f", "g"] }).success).toBe(
      false,
    );
    expect(AssessmentItem.safeParse({ ...MCQ, answer: 4 }).success).toBe(false);
    expect(AssessmentItem.safeParse({ ...MCQ, answer: -1 }).success).toBe(false);
    expect(AssessmentItem.safeParse({ ...MCQ, explanation: undefined }).success).toBe(false);
  });

  it("reads an open or practical item with a rubric, for AI-led diagnostics", () => {
    const open = {
      ...MCQ,
      slug: "sql-3-plan",
      format: "open",
      options: undefined,
      answer: undefined,
      explanation: undefined,
      rubric: "Names the sequential scan and proposes an index on the filtered column.",
    };
    expect(AssessmentItem.safeParse(open).success).toBe(true);
    expect(AssessmentItem.safeParse({ ...open, rubric: undefined }).success).toBe(false);
    expect(AssessmentItem.safeParse({ ...open, format: "essay" }).success).toBe(false);
  });

  it("allows a hand-written item with no ai block", () => {
    const item = AssessmentItem.parse({ ...MCQ, ai: undefined });
    expect(item.ai).toBeNull();
  });

  it("refuses a field that belongs to the other format, so nothing is silently dropped", () => {
    expect(AssessmentItem.safeParse({ ...MCQ, rubric: "Names the join." }).success).toBe(false);
    const open = {
      ...MCQ,
      format: "open",
      options: undefined,
      answer: undefined,
      explanation: undefined,
      rubric: "Names the join.",
    };
    expect(AssessmentItem.safeParse({ ...open, options: ["a", "b"] }).success).toBe(false);
    expect(AssessmentItem.safeParse({ ...open, answer: 1 }).success).toBe(false);
    expect(AssessmentItem.safeParse({ ...open, explanation: "Because." }).success).toBe(false);
  });

  it("refuses a skill or an option named twice, which would make the item ambiguous", () => {
    expect(AssessmentItem.safeParse({ ...MCQ, skills: ["sql", "sql"] }).success).toBe(false);
    expect(AssessmentItem.safeParse({ ...MCQ, options: ["a", "b", "a"] }).success).toBe(false);
  });
});
