import { describe, expect, it } from "vitest";
import { ok } from "../../result.ts";
import { fakeProvider } from "../../testing/fake-provider.ts";
import { runTask } from "../run-task.ts";
import { prepareCall } from "../task.ts";
import { explainGap } from "./explain-gap.ts";

const level = (name: string) => ({ name, description: `Someone at ${name} level.` });
const INPUT = {
  pathway: {
    title: "Machine-learning engineer",
    summary: "Builds, ships and runs machine-learning systems in production.",
  },
  scale: {
    0: level("None"),
    1: level("Aware"),
    2: level("Working"),
    3: level("Practitioner"),
    4: level("Expert"),
  },
  requirements: [
    {
      skill: "python",
      name: "Python",
      importance: "core" as const,
      required: 3,
      shown: { level: 2, provenance: "self-reported" as const },
      group: "below" as const,
      evidence: ["Payments API", 'A "quoted"\ntitle'],
    },
    {
      skill: "docker",
      name: "Docker",
      importance: "helpful" as const,
      required: 2,
      shown: null,
      group: "unknown" as const,
      evidence: [],
    },
  ],
};
const NOW = { model: "m", now: () => new Date("2026-11-07T10:00:00Z") };
const ANSWER = {
  meaning: "Python is close; Docker is unknown so far.",
  starts: [{ skill: "python", why: "It is core, and you are one level off." }],
};

describe("the explain-gap task (MVP S18.1, S18.2)", () => {
  it("is registered as explain-gap@1", () => {
    expect(explainGap.id).toBe("explain-gap@1");
  });

  it("sends where the person stands and the titles of the evidence their levels cite, as data (S18.1)", () => {
    const call = prepareCall(explainGap, INPUT);
    expect(call.parts).toEqual([
      {
        kind: "gap",
        text: [
          "Requirement: python",
          "Level: 2, self-reported",
          "Group: below",
          'Evidence its level cites: "Payments API"; "A \\"quoted\\"\\ntitle"',
          "",
          "Requirement: docker",
          "Level: none yet",
          "Group: unknown",
        ].join("\n"),
      },
    ]);
    expect(call.request.prompt).not.toContain("Builds, ships");
  });

  it("names the pathway, each requirement and the scale in Pharoam's instructions, never the person's text", () => {
    const { system } = prepareCall(explainGap, INPUT).request;
    expect(system).toContain("Machine-learning engineer: Builds, ships and runs machine-learning systems");
    expect(system).toContain("- python: Python, level 3 Practitioner, core");
    expect(system).toContain("- docker: Docker, level 2 Working, helpful");
    expect(system).toContain("2 Working: Someone at Working level.");
    expect(system).not.toContain("Payments API");
  });

  it("gives back what the gap might mean and places to start, with no level or score (S18.2)", async () => {
    const answer = await runTask(
      fakeProvider(() => ok({ ...ANSWER, score: 62, level: 3 })),
      explainGap,
      INPUT,
      NOW,
    );
    expect(answer.ok && answer.value.output).toEqual(ANSWER);
  });

  it("rejects a place to start that isn't one of the pathway's requirements, or is named twice (S18.2)", async () => {
    const answer = await runTask(
      fakeProvider(() =>
        ok({
          ...ANSWER,
          starts: [...ANSWER.starts, { skill: "kubernetes", why: "Popular." }, ANSWER.starts[0]],
        }),
      ),
      explainGap,
      INPUT,
      NOW,
    );
    expect(answer.ok ? null : answer.error.reason).toEqual({
      kind: "invalid-answer",
      issues: ["starts: kubernetes isn't one of the pathway's requirements", "starts: python is named twice"],
    });
  });

  it("allows no places to start, as when every requirement is met", async () => {
    const answer = await runTask(
      fakeProvider(() => ok({ ...ANSWER, starts: [] })),
      explainGap,
      INPUT,
      NOW,
    );
    expect(answer.ok && answer.value.output.starts).toEqual([]);
  });

  it("rejects more than three places to start, so the card stays short", async () => {
    const start = (skill: string) => ({ skill, why: "Core." });
    const four = {
      ...INPUT,
      requirements: ["python", "docker", "sql", "git"].map((skill) => ({
        skill,
        name: skill,
        importance: "core" as const,
        required: 2,
        shown: null,
        group: "unknown" as const,
        evidence: [],
      })),
    };
    const answer = await runTask(
      fakeProvider(() => ok({ ...ANSWER, starts: four.requirements.map(({ skill }) => start(skill)) })),
      explainGap,
      four,
      NOW,
    );
    expect(answer.ok ? null : answer.error.reason.kind).toBe("invalid-answer");
  });

  it("rejects a blank explanation", async () => {
    const answer = await runTask(
      fakeProvider(() => ok({ ...ANSWER, meaning: "  " })),
      explainGap,
      INPUT,
      NOW,
    );
    expect(answer.ok ? null : answer.error.reason.kind).toBe("invalid-answer");
  });

  it("needs at least one requirement to explain", () => {
    expect(() => prepareCall(explainGap, { ...INPUT, requirements: [] })).toThrow();
  });
});
