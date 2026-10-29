/**
 * Content packs: the skill vocabulary, level scale and pathways, compiled into one versioned bundle.
 *
 * @remarks Content is written as Markdown records in `data/` and `content/` and compiled at build time into a JSON
 * pack with a manifest (ADR-0005, AD16). The app ships one built-in pack and works offline; packs loaded later from a
 * URL or the person's storage use the same format and are checked with the same schema (interfaces §6).
 * @packageDocumentation
 */
import { z } from "zod";
import { parseRecordFile } from "./record-file.ts";
import { err, ok, type Result } from "./result.ts";
import { LevelScale } from "./schemas/levels.ts";
import { PackManifest } from "./schemas/pack.ts";
import { PathwayRecord } from "./schemas/pathway.ts";
import { SkillEntry } from "./schemas/skill.ts";

/** A compiled content pack, as the app loads it. */
export const ContentPack = z.object({
  /** The compiled format and its version. */
  format: z.literal("pharoam-pack/1"),
  /** The pack's manifest, with `contents` listing every skill and pathway in it. */
  manifest: PackManifest,
  /** The shared level scale. */
  levels: LevelScale,
  /** Every skill in the vocabulary, by slug. */
  skills: z.array(SkillEntry),
  /** Every pathway, by slug. */
  pathways: z.array(PathwayRecord),
});

/** A compiled content pack as Pharoam reads it. */
export type ContentPack = z.output<typeof ContentPack>;

/** One content file to compile. */
export interface ContentFile {
  /** Where the file is, such as `data/skills/python.md`, for reporting problems. */
  readonly path: string;
  /** The file's text. */
  readonly text: string;
}

/** One problem that stops a pack compiling. */
export interface ContentProblem {
  /** The file with the problem, or an empty string for a problem with the pack as a whole. */
  readonly path: string;
  /** What is wrong, in plain English, for the build output. */
  readonly message: string;
}

/** Content that can't be compiled into a pack. */
export interface InvalidContentError {
  /** Always `"invalid-content"`. */
  readonly kind: "invalid-content";
  /** Every problem found, sorted by file. */
  readonly problems: readonly ContentProblem[];
}

interface Found<T> {
  readonly path: string;
  readonly value: T;
}

/**
 * Compiles content files into a pack.
 *
 * @remarks Every file must be a valid `skill/1`, `pathway/1`, `levels/1` or `pack/1` record, with exactly one
 * manifest and one level scale. Every skill a pathway or another skill refers to must exist. All problems are
 * reported, not just the first, so one build shows everything to fix. The output is the same whatever order the
 * files come in.
 * @param files - The content files, such as everything in `data/` and `content/` except READMEs.
 * @returns The pack, with skills and pathways sorted by slug and the manifest's `contents` filled in; or every
 * problem found.
 */
export function compileContentPack(files: readonly ContentFile[]): Result<ContentPack, InvalidContentError> {
  const problems: ContentProblem[] = [];
  const skills = new Map<string, Found<SkillEntry>>();
  const pathways = new Map<string, Found<PathwayRecord>>();
  let manifest: Found<PackManifest> | undefined;
  let levels: Found<LevelScale> | undefined;

  const validate = <T>(schema: z.ZodType<T>, top: unknown, path: string): T | undefined => {
    const result = schema.safeParse(top);
    if (result.success) return result.data;
    const fields = new Set(
      result.error.issues.map((issue) => issue.path.map(String).join(".") || "the top block"),
    );
    for (const field of fields) problems.push({ path, message: `Has an invalid field: ${field}.` });
    return undefined;
  };

  for (const { path, text } of files.toSorted((a, b) => compare(a.path, b.path))) {
    const file = parseRecordFile(text);
    if (!file.ok) {
      problems.push({ path, message: `Isn't a record file: ${file.error.kind}.` });
      continue;
    }
    const { top } = file.value;
    switch (top.schema) {
      case "skill/1": {
        const skill = validate(SkillEntry, top, path);
        if (skill === undefined) break;
        const earlier = skills.get(skill.slug);
        if (earlier === undefined) skills.set(skill.slug, { path, value: skill });
        else problems.push({ path, message: `Repeats the skill ${skill.slug}, also in ${earlier.path}.` });
        break;
      }
      case "pathway/1": {
        const pathway = validate(PathwayRecord, top, path);
        if (pathway === undefined) break;
        const earlier = pathways.get(pathway.slug);
        if (earlier === undefined) pathways.set(pathway.slug, { path, value: pathway });
        else
          problems.push({ path, message: `Repeats the pathway ${pathway.slug}, also in ${earlier.path}.` });
        break;
      }
      case "levels/1": {
        const scale = validate(LevelScale, top, path);
        if (scale === undefined) break;
        if (levels === undefined) levels = { path, value: scale };
        else problems.push({ path, message: `Repeats the level scale, also in ${levels.path}.` });
        break;
      }
      case "pack/1": {
        const found = validate(PackManifest, top, path);
        if (found === undefined) break;
        if (manifest === undefined) manifest = { path, value: found };
        else problems.push({ path, message: `Repeats the pack manifest, also in ${manifest.path}.` });
        break;
      }
      default:
        problems.push({ path, message: `Has an unknown schema: ${String(top.schema)}.` });
    }
  }

  for (const { path, value } of skills.values()) {
    for (const target of [...value.relations.implies, ...value.relations.related]) {
      if (!skills.has(target)) problems.push({ path, message: `Relates to the unknown skill ${target}.` });
    }
    if (value.replaced_by !== undefined && !skills.has(value.replaced_by)) {
      problems.push({ path, message: `Is replaced by the unknown skill ${value.replaced_by}.` });
    }
  }
  for (const { path, value } of pathways.values()) {
    for (const { skill } of value.requirements) {
      if (!skills.has(skill)) problems.push({ path, message: `Requires the unknown skill ${skill}.` });
    }
    for (const skill of value.transferable) {
      if (!skills.has(skill))
        problems.push({ path, message: `Lists the unknown transferable skill ${skill}.` });
    }
  }
  if (manifest === undefined) problems.push({ path: "", message: "Has no pack manifest (pack/1)." });
  if (levels === undefined) problems.push({ path: "", message: "Has no level scale (levels/1)." });

  if (manifest === undefined || levels === undefined || problems.length > 0) {
    return err({ kind: "invalid-content", problems: problems.toSorted((a, b) => compare(a.path, b.path)) });
  }

  const skillList = [...skills.values()]
    .map((found) => found.value)
    .toSorted((a, b) => compare(a.slug, b.slug));
  const pathwayList = [...pathways.values()]
    .map((found) => found.value)
    .toSorted((a, b) => compare(a.slug, b.slug));
  return ok({
    format: "pharoam-pack/1",
    manifest: {
      ...manifest.value,
      contents: { skills: skillList.map((s) => s.slug), pathways: pathwayList.map((p) => p.slug) },
    },
    levels: levels.value,
    skills: skillList,
    pathways: pathwayList,
  });
}

// Sorts by UTF-16 code units, the same on every platform and locale.
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
