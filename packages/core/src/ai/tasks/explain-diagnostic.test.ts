import { describe, expect, it } from "vitest";
import { ok } from "../../result.ts";
import { fakeProvider } from "../../testing/fake-provider.ts";
import { runTask } from "../run-task.ts";
import { prepareCall } from "../task.ts";
import { explainDiagnostic } from "./explain-diagnostic.ts";

const level = (name: string) => ({ name, description: `Someone at ${name} level.` });
const STEP = {
  format: "mcq" as const,
  level: 3,
  prompt: "Which join keeps unmatched rows?",
  answer: "INNER JOIN",
  correct: false,
};
const INPUT = {
  skill: "SQL: querying relational databases",
  scale: {
    0: level("None"),
    1: level("Aware"),
    2: level("Working"),
    3: level("Practitioner"),
    4: level("Expert"),
  },
  start: 3,
  result: 2,
  rule: "two-right-to-settle@1" as const,
  material: {
    evidence: [{ ref: "E1", text: "Payments database: wrote the reporting queries." }],
    claims: [{ level: 4, provenance: "self-reported" as const, since: "2026-10-24" }],
    earlier: [],
  },
  steps: [STEP],
};
const NOW = { model: "m", now: () => new Date("2026-11-23T10:00:00Z") };
const EXPLANATION = {
  showed: "Joins and filtering are solid; window functions weren't.",
  comparison: "Lower than the level 4 you claimed.",
  reasons: ["The reporting work may have used a tool that wrote the queries."],
  next_step: "Practise window functions with a ranking task.",
};

describe("the explain-diagnostic task (MVP S23.3)", () => {
  it("is registered as explain-diagnostic@1", () => {
    expect(explainDiagnostic.id).toBe("explain-diagnostic@1");
  });

  it("sends the person's material and the session's questions as data", () => {
    const call = prepareCall(explainDiagnostic, INPUT);
    expect(call.parts).toEqual([
      { kind: "skill", text: "SQL: querying relational databases" },
      { kind: "evidence", text: "Reference: E1\nPayments database: wrote the reporting queries." },
      { kind: "claims", text: "Level 4, self-reported, since 2026-10-24" },
      {
        kind: "question",
        text: [
          "Question 1, level 3, mcq, marked wrong",
          'Asked: "Which join keeps unmatched rows?"',
          'Answer: "INNER JOIN"',
        ].join("\n"),
      },
    ]);
    expect(call.request.system).not.toContain("Payments database");
  });

  it("states the level the published rule gave, and what the rule is, so the explanation never sets one (S23.3)", () => {
    const { system } = prepareCall(explainDiagnostic, INPUT).request;
    expect(system).toContain("started at level 3 Practitioner");
    expect(system).toContain("gave level 2 Working by the published rule two-right-to-settle@1");
    expect(system).toContain("the highest level with two answers marked right");
  });

  it("takes only the published rule, and levels on the scale", () => {
    expect(explainDiagnostic.input.safeParse({ ...INPUT, rule: "anything" }).success).toBe(false);
    expect(() => prepareCall(explainDiagnostic, { ...INPUT, result: 5 })).toThrow();
  });

  it("explains at most 12 questions", () => {
    const steps = Array.from({ length: 13 }, () => STEP);
    expect(() => prepareCall(explainDiagnostic, { ...INPUT, steps })).toThrow();
  });

  it("gives back what the session showed, the comparison, possible reasons and a next step, with no score", async () => {
    const answer = await runTask(
      fakeProvider(() => ok({ ...EXPLANATION, level: 3, confidence: 0.7 })),
      explainDiagnostic,
      INPUT,
      NOW,
    );
    expect(answer.ok && answer.value.output).toEqual(EXPLANATION);
  });

  it("allows no reasons, as when the result matches the claims", async () => {
    const answer = await runTask(
      fakeProvider(() => ok({ ...EXPLANATION, reasons: [] })),
      explainDiagnostic,
      INPUT,
      NOW,
    );
    expect(answer.ok && answer.value.output.reasons).toEqual([]);
  });

  it("rejects a blank next step", async () => {
    const answer = await runTask(
      fakeProvider(() => ok({ ...EXPLANATION, next_step: " " })),
      explainDiagnostic,
      INPUT,
      NOW,
    );
    expect(answer.ok ? null : answer.error.reason.kind).toBe("invalid-answer");
  });

  it("needs at least one question answered", () => {
    expect(() => prepareCall(explainDiagnostic, { ...INPUT, steps: [] })).toThrow();
  });
});
