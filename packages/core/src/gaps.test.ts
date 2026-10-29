import { describe, expect, it } from "vitest";
import { gapGroup, gapItems } from "./gaps.ts";
import { parseProfileRecord, type ProfileRecord } from "./schemas/profile-record.ts";

describe("grouping a requirement (MVP §3, PRD F3)", () => {
  it.each([
    [3, { level: 3, provenance: "demonstrated" }, "supported"],
    [3, { level: 4, provenance: "ai-correlated" }, "supported"],
    [3, { level: 3, provenance: "self-reported" }, "claimed"],
    [3, { level: 4, provenance: "ai-judged" }, "claimed"],
    [3, { level: 2, provenance: "demonstrated" }, "below"],
    [3, { level: 2, provenance: "self-reported" }, "below"],
    [3, undefined, "unknown"],
  ] as const)("a level-%i requirement against %o is %s", (required, shown, group) => {
    expect(gapGroup(required, shown)).toBe(group);
  });
});

const id = (n: number): string => `0192f3a1-0000-7000-8000-0000000001${String(n).padStart(2, "0")}`;

function record(top: Readonly<Record<string, unknown>>): ProfileRecord {
  const parsed = parseProfileRecord({ id: id(99), created: "2026-10-01T10:00:00Z", ...top });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
  return parsed.value;
}

const requirement = (skill: string, name: string, level: number, importance: "core" | "helpful") => ({
  skill,
  name,
  level,
  importance,
});

const PATHWAY = {
  requirements: [
    requirement("python", "Python", 3, "core"),
    requirement("pytorch", "PyTorch", 2, "core"),
    requirement("docker", "Docker", 2, "helpful"),
    requirement("sql", "SQL", 2, "helpful"),
  ],
};

const EVIDENCE = record({
  schema: "evidence/1",
  id: id(50),
  kind: "job",
  title: "Backend Engineer",
  source: "manual",
});

const skill = (slug: string, entries: readonly Readonly<Record<string, unknown>>[]) =>
  record({ schema: "skill-record/1", id: id(slug.length), skill: slug, entries });

describe("the gap to a pathway (MVP S11.1, S11.2, S11.7)", () => {
  it("groups each requirement by the skill's shown level, with its source and cited evidence", () => {
    const records = [
      EVIDENCE,
      skill("python", [
        {
          id: id(1),
          level: 3,
          provenance: "self-reported",
          observed_at: "2026-10-01T10:00:00Z",
          evidence: [id(50), id(51)],
        },
      ]),
      skill("pytorch", [
        { id: id(2), level: 1, provenance: "self-reported", observed_at: "2026-10-01T10:00:00Z" },
      ]),
      // Docker is related to nothing here, and SQL has no record: related skills never count for each other.
      skill("postgres", [
        { id: id(3), level: 4, provenance: "self-reported", observed_at: "2026-10-01T10:00:00Z" },
      ]),
    ];
    expect(gapItems(PATHWAY, records)).toEqual([
      {
        skill: "python",
        name: "Python",
        importance: "core",
        required: 3,
        shown: { level: 3, provenance: "self-reported" },
        group: "claimed",
        evidence: [
          { id: id(50), title: "Backend Engineer" },
          // Evidence deleted since keeps its ID, with no title (MVP S5.2).
          { id: id(51) },
        ],
      },
      {
        skill: "pytorch",
        name: "PyTorch",
        importance: "core",
        required: 2,
        shown: { level: 1, provenance: "self-reported" },
        group: "below",
        evidence: [],
      },
      {
        skill: "docker",
        name: "Docker",
        importance: "helpful",
        required: 2,
        shown: null,
        group: "unknown",
        evidence: [],
      },
      {
        skill: "sql",
        name: "SQL",
        importance: "helpful",
        required: 2,
        shown: null,
        group: "unknown",
        evidence: [],
      },
    ]);
  });

  it("uses the shown level, so a retracted level no longer counts", () => {
    const records = [
      skill("python", [
        { id: id(1), level: 4, provenance: "self-reported", observed_at: "2026-10-01T10:00:00Z" },
        { id: id(2), target: id(1), decision: "retract", reviewed_at: "2026-10-02T10:00:00Z" },
      ]),
    ];
    expect(gapItems(PATHWAY, records)[0]).toMatchObject({ shown: null, group: "unknown" });
  });

  it("never scores, totals or ranks (S11.3), nor calls anything verified (S11.7)", () => {
    const text = JSON.stringify(gapItems(PATHWAY, [skill("python", [])]));
    expect(text).not.toMatch(/score|percent|total|rank|verified/i);
  });
});
