import { describe, expect, it } from "vitest";
import { SKILL_FILE } from "../__fixtures__/content-records.ts";
import { parseRecordFile } from "../record-file.ts";
import { SkillEntry } from "./skill.ts";

function top(text: string): Readonly<Record<string, unknown>> {
  const result = parseRecordFile(text);
  if (!result.ok) throw new Error(result.error.kind);
  return result.value.top;
}

const MINIMAL = {
  schema: "skill/1",
  slug: "sql",
  name: "SQL",
  domain: "Data",
  origin: { source: "MIND Tech Ontology", licence: "MIT" },
};

describe("skill inventory entry", () => {
  it("validates the example", () => {
    const entry = SkillEntry.parse(top(SKILL_FILE));
    expect(entry.levels?.["3"]).toBe(
      "Builds and maintains production Python code, with tests and packaging.",
    );
    expect(entry.refs).toEqual({
      esco: "http://data.europa.eu/esco/skill/ccd0a1d9-afda-43d9-b901-96344886e14d",
      wikidata: "Q28865",
      github_topic: "python",
    });
  });

  it("needs no skill-specific levels, which v0.1 has only for pathway skills (MVP §3)", () => {
    expect(SkillEntry.parse(MINIMAL)).toEqual({
      ...MINIMAL,
      aliases: [],
      relations: { implies: [], related: [] },
      status: "active",
    });
  });

  it("describes all five levels when it describes any", () => {
    const levels = { 0: "a", 1: "b", 2: "c", 3: "d" };
    expect(SkillEntry.safeParse({ ...MINIMAL, levels }).success).toBe(false);
  });

  it("keeps custom- slugs for the person's own skills (MVP S8)", () => {
    expect(SkillEntry.safeParse({ ...MINIMAL, slug: "custom-sql" }).success).toBe(false);
  });

  it("says what replaces a deprecated skill, so old profiles keep working", () => {
    expect(SkillEntry.safeParse({ ...MINIMAL, status: "deprecated" }).error?.issues).toEqual([
      expect.objectContaining({ path: ["replaced_by"] }),
    ]);
    expect(SkillEntry.safeParse({ ...MINIMAL, status: "deprecated", replaced_by: "postgres" }).success).toBe(
      true,
    );
  });

  it("checks the form of each cross-reference", () => {
    for (const refs of [
      { esco: "https://example.com/skill" },
      { wikidata: "28865" },
      { github_topic: "Python" },
    ]) {
      expect(SkillEntry.safeParse({ ...MINIMAL, refs }).success).toBe(false);
    }
  });

  it("credits where the entry came from", () => {
    expect(SkillEntry.safeParse({ ...MINIMAL, origin: undefined }).success).toBe(false);
    expect(SkillEntry.safeParse({ ...MINIMAL, origin: { source: "MIND" } }).success).toBe(false);
  });
});
