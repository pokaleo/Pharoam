import { describe, expect, it } from "vitest";
import { proficiencyOf } from "./proficiency.ts";
import { Proficiency, SkillRecord } from "./schemas/skill-record.ts";

function entries(list: readonly Readonly<Record<string, unknown>>[]): SkillRecord["entries"] {
  return SkillRecord.parse({
    schema: "skill-record/1",
    id: "0192f3a1-0000-7000-8000-000000000010",
    created: "2026-10-01T10:00:00Z",
    skill: "python",
    entries: list,
  }).entries;
}

const id = (n: number): string => `0192f3a1-0000-7000-8000-0000000001${String(n).padStart(2, "0")}`;

const claim = (n: number, level: number, at: string) => ({
  id: id(n),
  level,
  provenance: "self-reported",
  observed_at: at,
});

const tested = (n: number, level: number, at: string) => ({
  id: id(n),
  level,
  provenance: "demonstrated",
  observed_at: at,
  assessment: id(90),
});

describe("the proficiency summary (MVP S9.2, data model §6)", () => {
  it("holds the shown level, since when, and the latest level from each source", () => {
    const summary = proficiencyOf(
      entries([claim(1, 2, "2026-10-01T10:00:00Z"), claim(2, 3, "2026-10-24T08:00:00+01:00")]),
    );
    expect(summary).toEqual({
      shown: { level: 3, provenance: "self-reported", since: "2026-10-24", observation: id(2) },
      "by-source": { "self-reported": { level: 3, since: "2026-10-24" } },
    });
    expect(Proficiency.safeParse(summary).success).toBe(true);
  });

  it("notes a newer claim that differs from a tested level, never showing it as the level", () => {
    const summary = proficiencyOf(
      entries([
        claim(1, 3, "2026-10-05T10:00:00Z"),
        tested(2, 2, "2026-10-12T10:00:00Z"),
        claim(3, 4, "2026-10-24T10:00:00Z"),
      ]),
    );
    expect(summary).toEqual({
      shown: { level: 2, provenance: "demonstrated", since: "2026-10-12", observation: id(2) },
      "newer-claim": { level: 4, provenance: "self-reported", since: "2026-10-24" },
      "by-source": {
        "self-reported": { level: 4, since: "2026-10-24" },
        demonstrated: { level: 2, since: "2026-10-12" },
      },
    });
  });

  it("has no newer claim when the latest newer claim agrees with the tested level", () => {
    const summary = proficiencyOf(
      entries([
        tested(1, 2, "2026-10-12T10:00:00Z"),
        claim(2, 4, "2026-10-20T10:00:00Z"),
        claim(3, 2, "2026-10-24T10:00:00Z"),
      ]),
    );
    expect(summary && "newer-claim" in summary).toBe(false);
  });

  it("has no newer claim for a claim older than the tested level", () => {
    const summary = proficiencyOf(
      entries([claim(1, 4, "2026-10-01T10:00:00Z"), tested(2, 2, "2026-10-12T10:00:00Z")]),
    );
    expect(summary && "newer-claim" in summary).toBe(false);
  });

  it("notes an accepted AI judgement newer than a tested level, and keeps the later of two at the same time", () => {
    const judged = {
      id: id(3),
      level: 3,
      provenance: "ai-judged",
      observed_at: "2026-10-20T10:00:00Z",
      explanation: "Built and tested packages.",
      limits: "From evidence only.",
      ai: {
        task: "judge-level@1",
        model: "anthropic/claude-sonnet-5-5",
        at: "2026-10-20T10:00:00Z",
        confirmed_by_user: "2026-10-20T10:05:00Z",
      },
    };
    const summary = proficiencyOf(
      entries([
        {
          ...tested(1, 2, "2026-10-12T10:00:00Z"),
          provenance: "ai-correlated",
          explanation: "From the test.",
          ai: { task: "correlate@1", model: "anthropic/claude-sonnet-5-5", at: "2026-10-12T10:00:00Z" },
        },
        claim(2, 1, "2026-10-20T10:00:00Z"),
        judged,
      ]),
    );
    expect(summary?.shown.provenance).toBe("ai-correlated");
    expect(summary?.["newer-claim"]).toEqual({ level: 3, provenance: "ai-judged", since: "2026-10-20" });
  });

  it("leaves out superseded and retracted observations", () => {
    const summary = proficiencyOf(
      entries([
        claim(1, 2, "2026-10-01T10:00:00Z"),
        { ...claim(2, 3, "2026-10-02T10:00:00Z"), supersedes: id(1) },
        tested(3, 4, "2026-10-03T10:00:00Z"),
        { id: id(4), target: id(3), decision: "retract", reviewed_at: "2026-10-04T10:00:00Z" },
      ]),
    );
    expect(summary).toEqual({
      shown: { level: 3, provenance: "self-reported", since: "2026-10-02", observation: id(2) },
      "by-source": { "self-reported": { level: 3, since: "2026-10-02" } },
    });
  });

  it("is nothing when no observation counts", () => {
    expect(proficiencyOf(entries([]))).toBeUndefined();
    const retracted = entries([
      claim(1, 2, "2026-10-01T10:00:00Z"),
      { id: id(2), target: id(1), decision: "retract", reviewed_at: "2026-10-02T10:00:00Z" },
    ]);
    expect(proficiencyOf(retracted)).toBeUndefined();
  });
});
