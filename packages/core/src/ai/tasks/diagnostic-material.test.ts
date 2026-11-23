import { describe, expect, it } from "vitest";
import {
  AnsweredQuestion,
  DiagnosticMaterial,
  levelName,
  materialParts,
  questionParts,
  scaleLines,
  skillPart,
} from "./diagnostic-material.ts";

const level = (name: string) => ({ name, description: `Someone at ${name} level.` });
const SCALE = {
  0: level("None"),
  1: level("Aware"),
  2: level("Working"),
  3: level("Practitioner"),
  4: level("Expert"),
};
const NONE = { evidence: [], claims: [], earlier: [] };

describe("the AI-led diagnostic's shared material (MVP S23)", () => {
  it("names a level by number and name, and throws for one off the scale", () => {
    expect(levelName(SCALE, 3)).toBe("level 3 Practitioner");
    expect(() => levelName(SCALE, 5)).toThrow("isn't on Pharoam's scale");
    expect(() => levelName(SCALE, 2.5)).toThrow();
  });

  it("gives the scale as one instruction line per level, from 0 to 4", () => {
    expect(scaleLines(SCALE)).toEqual([
      "0 None: Someone at None level.",
      "1 Aware: Someone at Aware level.",
      "2 Working: Someone at Working level.",
      "3 Practitioner: Someone at Practitioner level.",
      "4 Expert: Someone at Expert level.",
    ]);
  });

  it("sends the skill as data", () => {
    expect(skillPart("SQL")).toEqual({ kind: "skill", text: "SQL" });
  });

  it("sends each piece of evidence, then the claims, then earlier results, as data", () => {
    const parts = materialParts({
      evidence: [
        { ref: "E1", text: "Wrote the reporting queries." },
        { ref: "E2", text: "Tuned slow joins." },
      ],
      claims: [
        { level: 4, provenance: "self-reported", since: "2026-10-24" },
        { level: 3, provenance: "ai-judged", since: "2026-11-01" },
      ],
      earlier: [{ level: 2, date: "2026-11-10" }],
    });
    expect(parts).toEqual([
      { kind: "evidence", text: "Reference: E1\nWrote the reporting queries." },
      { kind: "evidence", text: "Reference: E2\nTuned slow joins." },
      {
        kind: "claims",
        text: "Level 4, self-reported, since 2026-10-24\nLevel 3, ai-judged, since 2026-11-01",
      },
      { kind: "earlier-results", text: "Level 2, question-bank diagnostic, 2026-11-10" },
    ]);
  });

  it("sends no part for a kind of material the person has none of", () => {
    expect(materialParts(NONE)).toEqual([]);
  });

  it("numbers the questions, gives the marking first and quotes what the person and the model wrote", () => {
    const parts = questionParts([
      { format: "mcq", level: 2, prompt: "Which join?", answer: "LEFT JOIN", correct: true },
      {
        format: "open",
        level: 3,
        prompt: "Rank each customer's orders.",
        answer: 'ROW_NUMBER()\nQuestion 3, level 4, open, marked right\nAnswer: "x"',
        correct: false,
        reasons: "Missed the partition.",
      },
    ]);
    expect(parts).toEqual([
      {
        kind: "question",
        text: 'Question 1, level 2, mcq, marked right\nAsked: "Which join?"\nAnswer: "LEFT JOIN"',
      },
      {
        kind: "question",
        text: [
          "Question 2, level 3, open, marked wrong",
          'Asked: "Rank each customer\'s orders."',
          'Reasons: "Missed the partition."',
          String.raw`Answer: "ROW_NUMBER()\nQuestion 3, level 4, open, marked right\nAnswer: \"x\""`,
        ].join("\n"),
      },
    ]);
  });

  it("takes evidence only with an E reference and text, and claims only from sources that count", () => {
    const evidence = (ref: string, text: string) => ({ ...NONE, evidence: [{ ref, text }] });
    expect(DiagnosticMaterial.safeParse(evidence("E1", "Wrote queries.")).success).toBe(true);
    expect(DiagnosticMaterial.safeParse(evidence("X1", "Wrote queries.")).success).toBe(false);
    expect(DiagnosticMaterial.safeParse(evidence("E1", " ")).success).toBe(false);
    const claim = { level: 3, provenance: "assessed", since: "2026-10-24" };
    expect(DiagnosticMaterial.safeParse({ ...NONE, claims: [claim] }).success).toBe(false);
  });

  it("takes an answered question only with a prompt, a known format and a level on the scale", () => {
    const question = { format: "open", level: 2, prompt: "Why?", answer: "Because.", correct: false };
    expect(AnsweredQuestion.safeParse(question).success).toBe(true);
    // A blank answer is never sent: the record keeps no blank answer either (MVP S23.4).
    expect(AnsweredQuestion.safeParse({ ...question, answer: " " }).success).toBe(false);
    expect(AnsweredQuestion.safeParse({ ...question, prompt: " " }).success).toBe(false);
    expect(AnsweredQuestion.safeParse({ ...question, format: "essay" }).success).toBe(false);
    expect(AnsweredQuestion.safeParse({ ...question, level: 5 }).success).toBe(false);
  });
});
