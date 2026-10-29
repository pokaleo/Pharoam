import { describe, expect, it } from "vitest";
import { countingObservations, shownObservation, skillHistory } from "./skill-history.ts";
import { SkillRecord } from "./schemas/skill-record.ts";

// A skill record whose entries are given in file order.
function record(entries: readonly Readonly<Record<string, unknown>>[]): SkillRecord {
  return SkillRecord.parse({
    schema: "skill-record/1",
    id: "0192f3a1-0000-7000-8000-000000000010",
    created: "2026-10-01T10:00:00Z",
    skill: "python",
    entries,
  });
}

const id = (n: number): string => `0192f3a1-0000-7000-8000-0000000001${String(n).padStart(2, "0")}`;

function claim(n: number, level: number, at: string, extra: Readonly<Record<string, unknown>> = {}) {
  return { id: id(n), level, provenance: "self-reported", observed_at: at, ...extra };
}

function tested(n: number, level: number, at: string) {
  return { id: id(n), level, provenance: "demonstrated", observed_at: at, assessment: id(90) };
}

function retract(n: number, target: number, at: string) {
  return { id: id(n), target: id(target), decision: "retract", reviewed_at: at };
}

describe("which observations count (MVP S7.1, S7.2)", () => {
  it("leaves out superseded and retracted observations", () => {
    const entries = record([
      claim(1, 2, "2026-10-01T10:00:00Z"),
      claim(2, 3, "2026-10-02T10:00:00Z", { supersedes: id(1) }),
      claim(3, 4, "2026-10-03T10:00:00Z"),
      retract(4, 3, "2026-10-04T10:00:00Z"),
    ]).entries;
    expect(countingObservations(entries).map((o) => o.id)).toEqual([id(2)]);
  });
});

describe("the shown level (data model §6)", () => {
  it("is the latest self-reported level when nothing is tested", () => {
    const entries = record([
      claim(1, 2, "2026-10-02T10:00:00Z"),
      claim(2, 3, "2026-10-01T10:00:00Z"),
    ]).entries;
    expect(shownObservation(entries)?.id).toBe(id(1));
  });

  it("is the latest tested level, even when a claim is newer", () => {
    const entries = record([
      tested(1, 2, "2026-10-01T10:00:00Z"),
      tested(2, 1, "2026-10-02T10:00:00Z"),
      claim(3, 4, "2026-10-03T10:00:00Z"),
    ]).entries;
    expect(shownObservation(entries)?.id).toBe(id(2));
  });

  it("is an accepted AI judgement before a self-reported level", () => {
    const judged = {
      id: id(2),
      level: 3,
      provenance: "ai-judged",
      observed_at: "2026-10-01T10:00:00Z",
      explanation: "Built and tested packages.",
      limits: "From evidence only.",
      ai: {
        task: "judge-level@1",
        model: "anthropic/claude-sonnet-5-5",
        at: "2026-10-01T10:00:00Z",
        confirmed_by_user: "2026-10-01T10:05:00Z",
      },
    };
    const entries = record([claim(1, 4, "2026-10-02T10:00:00Z"), judged]).entries;
    expect(shownObservation(entries)?.id).toBe(id(2));
  });

  it("falls back to the previous level when the latest is retracted", () => {
    const entries = record([
      claim(1, 2, "2026-10-01T10:00:00Z"),
      claim(2, 4, "2026-10-02T10:00:00Z"),
      retract(3, 2, "2026-10-03T10:00:00Z"),
    ]).entries;
    expect(shownObservation(entries)?.id).toBe(id(1));
  });

  it("is nothing when every observation is retracted", () => {
    const entries = record([
      claim(1, 2, "2026-10-01T10:00:00Z"),
      retract(2, 1, "2026-10-02T10:00:00Z"),
    ]).entries;
    expect(shownObservation(entries)).toBeUndefined();
  });

  it("compares times as instants, across time zones", () => {
    const entries = record([
      claim(1, 2, "2026-10-02T01:00:00Z"),
      // 01:30 on 2 October in UTC, so the later of the two.
      claim(2, 3, "2026-10-01T23:30:00-02:00"),
    ]).entries;
    expect(shownObservation(entries)?.id).toBe(id(2));
  });
});

describe("a skill's history (MVP S7.3, PRD C6)", () => {
  it("lists every entry newest first, marking superseded, retracted and shown ones", () => {
    const skill = record([
      claim(1, 2, "2026-10-01T10:00:00Z"),
      claim(2, 3, "2026-10-02T10:00:00Z", { supersedes: id(1) }),
      claim(3, 4, "2026-10-03T10:00:00Z"),
      retract(4, 3, "2026-10-04T10:00:00Z"),
    ]);
    const integrity = [
      { kind: "intact" },
      { kind: "intact" },
      { kind: "intact" },
      { kind: "intact" },
    ] as const;
    expect(skillHistory(skill.entries, integrity)).toEqual([
      { kind: "review", entry: skill.entries[3], integrity: { kind: "intact" } },
      {
        kind: "observation",
        entry: skill.entries[2],
        status: "retracted",
        shown: false,
        integrity: { kind: "intact" },
      },
      {
        kind: "observation",
        entry: skill.entries[1],
        status: "counts",
        shown: true,
        integrity: { kind: "intact" },
      },
      {
        kind: "observation",
        entry: skill.entries[0],
        status: "superseded",
        shown: false,
        integrity: { kind: "intact" },
      },
    ]);
  });

  it("keeps file order for entries at the same time, newest written first, and labels outside edits", () => {
    const skill = record([claim(1, 2, "2026-10-01T10:00:00Z"), claim(2, 3, "2026-10-01T10:00:00Z")]);
    const history = skillHistory(skill.entries, [
      { kind: "intact" },
      { kind: "edited-outside", reason: "changed" },
    ]);
    expect(history.map((item) => [item.entry.id, item.integrity.kind])).toEqual([
      [id(2), "edited-outside"],
      [id(1), "intact"],
    ]);
  });
});
