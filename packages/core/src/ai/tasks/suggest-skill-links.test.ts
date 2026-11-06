import { describe, expect, it } from "vitest";
import { ok } from "../../result.ts";
import { fakeProvider } from "../../testing/fake-provider.ts";
import { runTask } from "../run-task.ts";
import { prepareCall } from "../task.ts";
import { suggestSkillLinks } from "./suggest-skill-links.ts";

const EVIDENCE = "Kind: job\nTitle: Backend Engineer\n\nBuilt the payments API in Python.";
const INPUT = {
  evidence: EVIDENCE,
  vocabulary: [
    { slug: "python", name: "Python" },
    { slug: "sql", name: "SQL" },
  ],
  custom: [{ slug: "custom-kdb-q", name: "KDB+/q" }],
};
const NOW = { model: "m", now: () => new Date("2026-11-06T10:00:00Z") };

describe("the suggest-skill-links task (MVP S16.1)", () => {
  it("is registered as suggest-skill-links@1", () => {
    expect(suggestSkillLinks.id).toBe("suggest-skill-links@1");
  });

  it("sends one record and the person's own skills as data, and the vocabulary as Pharoam's instructions", () => {
    const call = prepareCall(suggestSkillLinks, INPUT);
    expect(call.parts).toEqual([
      { kind: "evidence", text: EVIDENCE },
      { kind: "custom-skills", text: "custom-kdb-q: KDB+/q" },
    ]);
    expect(call.request.system).toContain("python: Python\nsql: SQL");
    expect(call.request.system).not.toContain("payments");
    expect(call.request.system).not.toContain("KDB");
  });

  it("sends no custom skills part when the person has none", () => {
    expect(prepareCall(suggestSkillLinks, { ...INPUT, custom: [] }).parts).toEqual([
      { kind: "evidence", text: EVIDENCE },
    ]);
  });

  it("asks for skills with an explanation each, and no level or confidence (hard rule 9)", async () => {
    const { system } = prepareCall(suggestSkillLinks, INPUT).request;
    expect(system).toMatch(/never a level/i);
    const answer = await runTask(
      fakeProvider(() =>
        ok({ links: [{ skill: "python", explanation: "Built it in Python.", confidence: 0.8 }] }),
      ),
      suggestSkillLinks,
      INPUT,
      NOW,
    );
    expect(answer.ok && answer.value.output).toEqual({
      links: [{ skill: "python", explanation: "Built it in Python." }],
    });
  });

  it("rejects an answer of another shape", async () => {
    const answer = await runTask(
      fakeProvider(() => ok({ links: [{ skill: "python" }] })),
      suggestSkillLinks,
      INPUT,
      NOW,
    );
    expect(answer.ok ? null : answer.error.reason.kind).toBe("invalid-answer");
  });
});
