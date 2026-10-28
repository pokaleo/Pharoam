/**
 * The JSON Schemas Pharoam publishes for its file formats, generated from the Zod schemas.
 *
 * @remarks Zod is the source of truth; the JSON Schemas are the neutral contract that lets other tools check
 * Pharoam's files without Pharoam (ADR-0007, data model §0). They describe a file as written, before Pharoam fills
 * in defaults, and allow fields Pharoam doesn't know. Checks a JSON Schema can't express, such as an end date after
 * its start, are left out.
 * @packageDocumentation
 */
import { z } from "zod";
import { PackManifest } from "./pack.ts";
import { PathwayRecord } from "./pathway.ts";
import { PROFILE_RECORD_SCHEMAS } from "./profile-record.ts";
import { SkillEntry } from "./skill.ts";

// Every record type, its name in a title, and its schema at the current format version.
const PUBLISHED: readonly (readonly [type: string, label: string, schema: z.ZodType])[] = [
  ["pharoam", "profile record (pharoam.md)", PROFILE_RECORD_SCHEMAS.pharoam],
  ["evidence", "evidence record", PROFILE_RECORD_SCHEMAS.evidence],
  ["skill-record", "skill record", PROFILE_RECORD_SCHEMAS["skill-record"]],
  ["gap", "gap record", PROFILE_RECORD_SCHEMAS.gap],
  ["skill", "skill inventory entry", SkillEntry],
  ["pathway", "pathway", PathwayRecord],
  ["pack", "content pack manifest", PackManifest],
];

const VERSION = 1;

/**
 * Generates the published JSON Schema for each record type and format version.
 *
 * @remarks The results are committed in `schemas/`, and a test fails when they no longer match (ENGINEERING §9).
 * @returns Each schema by its file name, such as `evidence-1.schema.json`, in a fixed order.
 */
export function publishedJsonSchemas(): Readonly<Record<string, Readonly<Record<string, unknown>>>> {
  return Object.fromEntries(
    PUBLISHED.map(([type, label, schema]) => {
      const { $schema, ...rest } = z.toJSONSchema(schema, { io: "input" });
      const document = {
        $schema,
        title: `Pharoam ${label}, format ${String(VERSION)}`,
        description: `The top block of a Pharoam file whose \`schema\` is \`${type}/${String(VERSION)}\`.`,
        ...rest,
      };
      return [`${type}-${String(VERSION)}.schema.json`, document];
    }),
  );
}
