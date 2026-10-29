import { describe, expect, it } from "vitest";
import { parseProfileRecord } from "./schemas/profile-record.ts";
import { SkillEntry } from "./schemas/skill.ts";
import { skillView } from "./skill-view.ts";

function vocabularyEntry(slug: string, name: string, domain: string, aliases: readonly string[] = []) {
  return SkillEntry.parse({
    schema: "skill/1",
    slug,
    name,
    aliases,
    domain,
    origin: { source: "Pharoam", licence: "CC-BY-4.0" },
  });
}

const VOCABULARY = [
  vocabularyEntry("python", "Python", "programming", ["Python 3"]),
  vocabularyEntry("postgres", "PostgreSQL", "data", ["Postgres"]),
  vocabularyEntry("docker", "Docker", "infrastructure"),
];

let next = 10;
// A stored record, as the service holds it.
function stored(location: string, top: Readonly<Record<string, unknown>>) {
  next += 1;
  const record = parseProfileRecord({
    id: `0192f3a1-0000-7000-8000-0000000000${String(next)}`,
    created: "2026-10-01T10:00:00Z",
    ...top,
  });
  if (!record.ok) throw new Error(record.error.kind);
  return { location, record: record.value };
}

const SHOWN = {
  shown: {
    level: 3,
    provenance: "self-reported",
    since: "2026-10-24",
    observation: "0192f3a1-0000-7000-8000-000000000101",
  },
} as const;

const skill = (slug: string, extra: Readonly<Record<string, unknown>> = {}) =>
  stored(`skills/${slug}.md`, { schema: "skill-record/1", skill: slug, ...extra });

const RECORDS = [
  skill("python", { proficiency: SHOWN }),
  skill("postgres"),
  skill("custom-kdb-q", { name: "KDB+/q", description: "Time-series queries." }),
  skill("retired-skill"),
  skill("docker", {
    proficiency: {
      shown: { ...SHOWN.shown, level: 2, provenance: "demonstrated" },
      "newer-claim": { level: 4, provenance: "self-reported", since: "2026-10-25" },
    },
  }),
  stored("pharoam.md", { schema: "pharoam/1", updated: "2026-10-01T10:00:00Z", ai: null }),
];

describe("the skill view (MVP S9.1, PRD C4)", () => {
  it("lists each of the person's skills once, by name, with its one shown level", () => {
    expect(skillView(RECORDS, VOCABULARY)).toEqual([
      {
        skill: "docker",
        name: "Docker",
        custom: false,
        domain: "infrastructure",
        shown: { ...SHOWN.shown, level: 2, provenance: "demonstrated" },
        newerClaim: { level: 4, provenance: "self-reported", since: "2026-10-25" },
        location: "skills/docker.md",
      },
      {
        skill: "custom-kdb-q",
        name: "KDB+/q",
        custom: true,
        location: "skills/custom-kdb-q.md",
      },
      {
        skill: "postgres",
        name: "PostgreSQL",
        custom: false,
        domain: "data",
        location: "skills/postgres.md",
      },
      {
        skill: "python",
        name: "Python",
        custom: false,
        domain: "programming",
        shown: SHOWN.shown,
        location: "skills/python.md",
      },
      // A skill no longer in the vocabulary is still listed, by its slug.
      { skill: "retired-skill", name: "retired-skill", custom: false, location: "skills/retired-skill.md" },
    ]);
  });
});

describe("narrowing the skill view (MVP S9.3)", () => {
  const names = (filter: Parameters<typeof skillView>[2]): readonly string[] =>
    skillView(RECORDS, VOCABULARY, filter).map((item) => item.skill);

  it("filters by domain", () => {
    expect(names({ domain: "data" })).toEqual(["postgres"]);
  });

  it("searches names, other names and slugs, ignoring case and accents", () => {
    expect(names({ query: "postgres" })).toEqual(["postgres"]);
    expect(names({ query: "PYTHON 3" })).toEqual(["python"]);
    expect(names({ query: "kdb" })).toEqual(["custom-kdb-q"]);
    expect(names({ query: "  " })).toHaveLength(5);
    expect(names({ query: "pýthon" })).toEqual(["python"]);
  });

  it("combines a domain and a search", () => {
    expect(names({ domain: "programming", query: "sql" })).toEqual([]);
  });
});
