import { createRecordFile, parseProfileRecord, type LoadedRecord } from "@pharoam/core";
import { describe, expect, it } from "vitest";
import { loadContentPack } from "../content.ts";
import { findSkill, skillChoices, skillName } from "./skills.ts";

function customSkill(slug: string, name: string): LoadedRecord {
  const top = {
    schema: "skill-record/1",
    id: "0192f3a1-0000-7000-8000-000000000009",
    created: "2026-10-01T09:00:00Z",
    skill: slug,
    name,
    entries: [],
  };
  const record = parseProfileRecord(top);
  if (!record.ok) throw new Error("invalid fixture");
  return {
    location: `skills/${slug}.md`,
    version: "v1",
    file: createRecordFile(top, ""),
    record: record.value,
    entryIntegrity: [],
  };
}

describe("skillChoices", () => {
  it("offers the vocabulary, then the person's own skills (MVP S8.2)", async () => {
    const pack = await loadContentPack();
    const choices = skillChoices(pack, [customSkill("custom-kdb", "Kdb+")]);
    expect(choices).toHaveLength(pack.skills.length + 1);
    expect(choices.at(-1)).toEqual({ slug: "custom-kdb", name: "Kdb+", aliases: [] });
  });
});

describe("findSkill", () => {
  const choices = [
    { slug: "ab-testing", name: "Experiment design and A/B testing", aliases: ["A/B testing"] },
    { slug: "sql", name: "SQL", aliases: [] },
  ];

  it("finds a skill by its name or another name, ignoring case and spaces at the ends", () => {
    expect(findSkill(choices, " sql ")?.slug).toBe("sql");
    expect(findSkill(choices, "a/b TESTING")?.slug).toBe("ab-testing");
  });

  it("finds nothing for a partial or empty name", () => {
    expect(findSkill(choices, "SQ")).toBeUndefined();
    expect(findSkill(choices, "  ")).toBeUndefined();
  });
});

describe("skillName", () => {
  it("names a slug, or shows the slug itself so nothing stored is hidden", () => {
    const choices = [{ slug: "sql", name: "SQL", aliases: [] }];
    expect(skillName(choices, "sql")).toBe("SQL");
    expect(skillName(choices, "retired-skill")).toBe("retired-skill");
  });
});
