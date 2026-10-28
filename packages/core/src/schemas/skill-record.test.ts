import { describe, expect, it } from "vitest";
import { SKILL_RECORD_FILE } from "../__fixtures__/profile-records.ts";
import { parseRecordFile } from "../record-file.ts";
import { Observation, Review, SkillRecord } from "./skill-record.ts";

function top(text: string): Readonly<Record<string, unknown>> {
  const result = parseRecordFile(text);
  if (!result.ok) throw new Error(result.error.kind);
  return result.value.top;
}

const AI = { task: "judge-skill-levels@1", model: "anthropic/claude-sonnet-5-5", at: "2026-10-05T09:58:00Z" };
const BASE = { id: "0192f3a1-0000-7000-8000-000000000011", level: 3, observed_at: "2026-10-01T10:00:00Z" };
const ASSESSMENT = "0192f3a1-0000-7000-8000-000000000020";

// Each provenance with exactly the fields it requires (data model §6).
const OBSERVATIONS = {
  "self-reported": { ...BASE, provenance: "self-reported" },
  "ai-judged": {
    ...BASE,
    provenance: "ai-judged",
    explanation: "Why.",
    limits: "What it couldn't see.",
    ai: { ...AI, confirmed_by_user: "2026-10-05T10:00:00Z" },
  },
  demonstrated: { ...BASE, provenance: "demonstrated", assessment: ASSESSMENT },
  "ai-correlated": {
    ...BASE,
    provenance: "ai-correlated",
    assessment: ASSESSMENT,
    explanation: "Why.",
    ai: AI,
  },
};

describe("skill record", () => {
  it("validates the example", () => {
    const record = SkillRecord.parse(top(SKILL_RECORD_FILE));
    expect(record.entries).toHaveLength(6);
    expect(record.proficiency).toEqual({
      shown: {
        level: 2,
        provenance: "ai-correlated",
        since: "2026-10-20",
        observation: "0192f3a1-0000-7000-8000-000000000014",
      },
      "newer-claim": { level: 4, provenance: "self-reported", since: "2026-10-24" },
      "by-source": {
        "self-reported": { level: 4, since: "2026-10-24" },
        demonstrated: { level: 2, since: "2026-10-12" },
        "ai-correlated": { level: 2, since: "2026-10-20" },
      },
    });
    expect(record.target).toBe(4);
  });

  it.each(Object.entries(OBSERVATIONS))(
    "accepts a %s observation with its required fields",
    (_name, entry) => {
      expect(Observation.safeParse(entry).success).toBe(true);
    },
  );

  it.each([
    ["ai-judged", "explanation"],
    ["ai-judged", "limits"],
    ["ai-judged", "ai"],
    ["demonstrated", "assessment"],
    ["ai-correlated", "assessment"],
    ["ai-correlated", "explanation"],
    ["ai-correlated", "ai"],
  ] as const)("rejects a %s observation without %s", (provenance, field) => {
    const entry = Object.fromEntries(
      Object.entries(OBSERVATIONS[provenance]).filter(([key]) => key !== field),
    );
    expect(Observation.safeParse(entry).success).toBe(false);
  });

  it("only writes an ai-judged observation once the person accepted it (PRD D2)", () => {
    expect(Observation.safeParse({ ...OBSERVATIONS["ai-judged"], ai: AI }).success).toBe(false);
  });

  it("rejects an unknown provenance and a level outside 0–4", () => {
    expect(Observation.safeParse({ ...BASE, provenance: "verified" }).success).toBe(false);
    expect(Observation.safeParse({ ...OBSERVATIONS["self-reported"], level: 5 }).success).toBe(false);
  });

  it("holds a review that retracts an observation", () => {
    const review = {
      id: "0192f3a1-0000-7000-8000-000000000016",
      target: "0192f3a1-0000-7000-8000-000000000012",
      decision: "retract",
      reviewed_at: "2026-10-25T10:00:00Z",
    };
    expect(Review.parse(review)).toEqual(review);
    expect(Review.safeParse({ ...review, decision: "accept" }).success).toBe(false);
  });

  it("needs a name for a custom skill (MVP S8.1)", () => {
    const record = {
      schema: "skill-record/1",
      id: "0192f3a1-0000-7000-8000-000000000010",
      created: "2026-10-01T10:00:00Z",
      skill: "custom-kdb-q",
    };
    expect(SkillRecord.safeParse(record).error?.issues).toEqual([
      expect.objectContaining({ path: ["name"] }),
    ]);
    expect(
      SkillRecord.safeParse({ ...record, name: "kdb+/q", description: "Time-series database" }).success,
    ).toBe(true);
  });

  it("accepts a new skill file with one self-reported observation (MVP S6.1)", () => {
    const record = {
      schema: "skill-record/1",
      id: "0192f3a1-0000-7000-8000-000000000010",
      created: "2026-10-01T10:00:00Z",
      skill: "python",
      entries: [OBSERVATIONS["self-reported"]],
    };
    expect(SkillRecord.parse(record)).toMatchObject({
      entries: [{ provenance: "self-reported", evidence: [] }],
    });
  });
});
