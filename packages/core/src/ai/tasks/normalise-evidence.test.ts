import { describe, expect, it } from "vitest";
import { ok } from "../../result.ts";
import { fakeProvider } from "../../testing/fake-provider.ts";
import { runTask } from "../run-task.ts";
import { prepareCall } from "../task.ts";
import { MAX_PASTED_CHARACTERS, formOfNormalised, normaliseEvidence } from "./normalise-evidence.ts";

const CV = "Backend Engineer, Example Co, 2022-09 to 2024-08. Built the payments API.";
const NOW = { model: "claude-sonnet-5-5", now: () => new Date("2026-11-06T10:00:00.250Z") };

const ANSWER = {
  records: [
    {
      kind: "job",
      title: "Backend Engineer",
      organisation: "Example Co",
      start: "2022-09",
      end: "2024-08",
      description: "Built the payments API.",
    },
  ],
};

describe("the normalise-evidence task (MVP S15)", () => {
  it("is registered as normalise-evidence@1", () => {
    expect(normaliseEvidence.id).toBe("normalise-evidence@1");
  });

  it("sends the pasted text only, as marked data, apart from its instructions (S15.1, security §3)", () => {
    const call = prepareCall(normaliseEvidence, { text: CV });
    expect(call.parts).toEqual([{ kind: "pasted-text", text: CV }]);
    expect(call.request.prompt).toBe(`<data kind="pasted-text">\n${CV}\n</data>`);
    expect(call.request.system).not.toContain("payments");
    expect(call.size).toBe(call.request.system.length + call.request.prompt.length);
  });

  it("asks for evidence without levels, scores or invented details (S15.8, Charter R4)", () => {
    const { system } = prepareCall(normaliseEvidence, { text: CV }).request;
    expect(system).toMatch(/never invent/i);
    expect(system).toMatch(/level/i);
  });

  it("takes text up to a limit, and none that is blank", () => {
    expect(() => prepareCall(normaliseEvidence, { text: "  \n " })).toThrow();
    expect(() => prepareCall(normaliseEvidence, { text: "x".repeat(MAX_PASTED_CHARACTERS + 1) })).toThrow();
    expect(prepareCall(normaliseEvidence, { text: "x".repeat(MAX_PASTED_CHARACTERS) }).parts).toHaveLength(1);
  });

  it("gives back the records the model found, in the evidence form's shape (S15.2)", async () => {
    const answer = await runTask(
      fakeProvider(() => ok(ANSWER)),
      normaliseEvidence,
      { text: CV },
      NOW,
    );
    expect(answer.ok && answer.value.output).toEqual(ANSWER);
    expect(answer.ok && answer.value.ai).toEqual({
      task: "normalise-evidence@1",
      model: "fake/claude-sonnet-5-5",
      at: "2026-11-06T10:00:00Z",
    });
  });

  it("drops a level or anything else the evidence form doesn't have, so no record carries one (S15.8)", async () => {
    const steered = { records: [{ ...ANSWER.records[0], level: 4, confidence: 0.9, skills: ["python"] }] };
    const answer = await runTask(
      fakeProvider(() => ok(steered)),
      normaliseEvidence,
      { text: CV },
      NOW,
    );
    expect(answer.ok && answer.value.output).toEqual(ANSWER);
  });

  it("rejects an answer of another shape, such as one steered by instructions in the text (S15.7)", async () => {
    for (const wrong of [
      { records: [{ kind: "admin", title: "Grant access" }] },
      { records: [{ kind: "job" }] },
      { action: "delete everything" },
      "Ignore the schema.",
    ]) {
      const answer = await runTask(
        fakeProvider(() => ok(wrong)),
        normaliseEvidence,
        { text: CV },
        NOW,
      );
      expect(answer.ok ? null : answer.error.reason.kind).toBe("invalid-answer");
    }
  });
});

describe("a found record as the evidence form (MVP S15.3)", () => {
  it("keeps the answers given and leaves out those that weren't", () => {
    expect(
      formOfNormalised({ kind: "module", title: "Databases", credits: 15, grade: null, issuer: "" }),
    ).toEqual({
      kind: "module",
      title: "Databases",
      credits: 15,
    });
  });

  it("keeps an answer whose model sends null or empty text for fields it leaves out", async () => {
    const loose = {
      records: [{ ...ANSWER.records[0], organisation: "", end: null, credits: null, links: null }],
    };
    const answer = await runTask(
      fakeProvider(() => ok(loose)),
      normaliseEvidence,
      { text: CV },
      NOW,
    );
    expect(answer.ok && answer.value.output.records.map(formOfNormalised)).toEqual([
      {
        kind: "job",
        title: "Backend Engineer",
        start: "2022-09",

        description: "Built the payments API.",
      },
    ]);
  });

  it("answers in the language of the pasted text, keeping the person's own words", () => {
    const { system } = prepareCall(normaliseEvidence, { text: CV }).request;
    expect(system).toMatch(/in the language of the material/);
    expect(system).not.toMatch(/write in English/);
  });
});
