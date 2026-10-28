import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LevelScale,
  PackManifest,
  parseRecordFile,
  PathwayRecord,
  SkillEntry,
  type SkillEntry as Skill,
} from "../packages/core/src/index.ts";

// Every content record in data/ and content/ must be valid, so a mistake fails CI, not the app (PRD I1, ADR-0005).
const root = path.join(import.meta.dirname, "..");
const SCHEMAS = {
  "skill/1": SkillEntry,
  "levels/1": LevelScale,
  "pathway/1": PathwayRecord,
  "pack/1": PackManifest,
};

function markdownFiles(dir: string): string[] {
  return readdirSync(path.join(root, dir), { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".md") && path.basename(file) !== "README.md")
    .map((file) => path.join(dir, file).split(path.sep).join("/"))
    .toSorted();
}

function top(file: string): Readonly<Record<string, unknown>> {
  const parsed = parseRecordFile(readFileSync(path.join(root, file), "utf8"));
  if (!parsed.ok) throw new Error(`${file}: ${JSON.stringify(parsed.error)}`);
  return parsed.value.top;
}

const files = [...markdownFiles("data"), ...markdownFiles("content")];
const skillFiles = files.filter((file) => file.startsWith("data/skills/"));
const skills: Skill[] = skillFiles.map((file) => SkillEntry.parse(top(file)));

describe("content and data", () => {
  it.each(files)("%s is a valid record", (file) => {
    const fields = top(file);
    const schema = SCHEMAS[fields.schema as keyof typeof SCHEMAS] as
      (typeof SCHEMAS)[keyof typeof SCHEMAS] | undefined;
    expect(schema, `${file} has an unknown schema: ${String(fields.schema)}`).toBeDefined();
    expect(schema?.safeParse(fields).error?.issues ?? []).toEqual([]);
  });

  it("has the shared level scale", () => {
    expect(files).toContain("data/levels.md");
  });

  it("has a vocabulary of about 300 skills (MVP §3)", () => {
    expect(skills.length).toBeGreaterThanOrEqual(200);
    expect(skills.length).toBeLessThanOrEqual(350);
  });

  it("names each skill file after its slug, so every slug is unique", () => {
    expect(skillFiles).toEqual(skills.map((skill) => `data/skills/${skill.slug}.md`));
  });

  it("relates and replaces skills only with skills in the vocabulary", () => {
    const slugs = new Set<string>(skills.map((skill) => skill.slug));
    const references = skills.flatMap((skill) =>
      [
        ...skill.relations.implies,
        ...skill.relations.related,
        ...(skill.replaced_by ? [skill.replaced_by] : []),
      ].map((target) => `${skill.slug} → ${target}`),
    );
    expect(references.filter((reference) => !slugs.has(reference.split(" → ")[1] ?? ""))).toEqual([]);
  });

  it("names each pathway file after its slug, and requires only skills in the vocabulary (MVP S8.3)", () => {
    const slugs = new Set<string>(skills.map((skill) => skill.slug));
    const pathwayFiles = files.filter((file) => file.startsWith("content/pathways/"));
    for (const file of pathwayFiles) {
      const pathway = PathwayRecord.parse(top(file));
      expect(file).toBe(`content/pathways/${pathway.slug}.md`);
      const skillsUsed = [...pathway.requirements.map((r) => r.skill), ...pathway.transferable];
      expect(
        skillsUsed.filter((skill) => !slugs.has(skill)),
        file,
      ).toEqual([]);
    }
  });

  it("credits every skill's source and licence (PRD I1)", () => {
    expect(
      skills.filter((skill) => !["MIND Tech Ontology", "Pharoam"].includes(skill.origin.source)),
    ).toEqual([]);
    expect(skills.filter((skill) => skill.origin.licence !== "MIT")).toEqual([]);
  });
});
