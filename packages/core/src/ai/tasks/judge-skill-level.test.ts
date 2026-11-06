import { describe, expect, it } from "vitest";
import { ok } from "../../result.ts";
import { fakeProvider } from "../../testing/fake-provider.ts";
import { runTask } from "../run-task.ts";
import { prepareCall } from "../task.ts";
import { judgeSkillLevel } from "./judge-skill-level.ts";

const level = (name: string) => ({ name, description: `Someone at ${name} level.` });
const INPUT = {
  skill: "Name: Python\nWhat it covers: Writing Python programs.",
  scale: {
    0: level("None"),
    1: level("Aware"),
    2: level("Working"),
    3: level("Practitioner"),
    4: level("Expert"),
  },
  evidence: [
    { ref: "E1", text: "Kind: job\nTitle: Backend Engineer\n\nBuilt the payments API in Python." },
    { ref: "E2", text: "Kind: project\nTitle: Shell search\n\nA small Python tool." },
  ],
};
const NOW = { model: "m", now: () => new Date("2026-11-06T10:00:00Z") };
const ANSWER = {
  level: 3,
  explanation: "Built and ran a Python API.",
  limits: "Two records only.",
  evidence: ["E1"],
};

describe("the judge-skill-level task (MVP S16.2, S16.3)", () => {
  it("is registered as judge-skill-level@1", () => {
    expect(judgeSkillLevel.id).toBe("judge-skill-level@1");
  });

  it("sends the skill and its linked evidence only, each record marked with its reference", () => {
    const call = prepareCall(judgeSkillLevel, INPUT);
    expect(call.parts).toEqual([
      { kind: "skill", text: INPUT.skill },
      { kind: "evidence", text: `Reference: E1\n${INPUT.evidence[0]?.text ?? ""}` },
      { kind: "evidence", text: `Reference: E2\n${INPUT.evidence[1]?.text ?? ""}` },
    ]);
    expect(call.request.system).toContain("3 Practitioner: Someone at Practitioner level.");
    expect(call.request.system).not.toContain("payments");
  });

  it("gives back a level with an explanation, its limits and the evidence it rests on, and no confidence", async () => {
    const answer = await runTask(
      fakeProvider(() => ok({ ...ANSWER, confidence: 0.7 })),
      judgeSkillLevel,
      INPUT,
      NOW,
    );
    expect(answer.ok && answer.value.output).toEqual(ANSWER);
  });

  it("rejects an answer citing evidence it wasn't sent (S16.3)", async () => {
    const answer = await runTask(
      fakeProvider(() => ok({ ...ANSWER, evidence: ["E1", "E7"] })),
      judgeSkillLevel,
      INPUT,
      NOW,
    );
    expect(answer.ok ? null : answer.error.reason).toEqual({
      kind: "invalid-answer",
      issues: ["evidence: E7 wasn't sent"],
    });
  });

  it("rejects a level outside the scale, or one resting on no evidence", async () => {
    for (const wrong of [
      { ...ANSWER, level: 5 },
      { ...ANSWER, level: 2.5 },
      { ...ANSWER, evidence: [] },
    ]) {
      const answer = await runTask(
        fakeProvider(() => ok(wrong)),
        judgeSkillLevel,
        INPUT,
        NOW,
      );
      expect(answer.ok ? null : answer.error.reason.kind).toBe("invalid-answer");
    }
  });

  it("needs at least one piece of evidence to judge from", () => {
    expect(() => prepareCall(judgeSkillLevel, { ...INPUT, evidence: [] })).toThrow();
  });
});
