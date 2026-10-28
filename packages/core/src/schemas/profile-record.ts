/**
 * Reads any v0.1 profile record's top block by the type and version it declares.
 *
 * @remarks Every record names its type and format version, such as `schema: evidence/1` (ADR-0007). A record that
 * fails is reported, never repaired, so it can be listed under "Needs attention" (MVP S12.2).
 * @packageDocumentation
 */
import type { z } from "zod";
import { err, ok, type Result } from "../result.ts";
import { EvidenceRecord } from "./evidence.ts";
import { GapRecord } from "./gap.ts";
import { PharoamRecord } from "./pharoam.ts";
import { SkillRecord } from "./skill-record.ts";

/** The schema for each profile record type, at the format version this Pharoam writes. */
export const PROFILE_RECORD_SCHEMAS = {
  pharoam: PharoamRecord,
  evidence: EvidenceRecord,
  "skill-record": SkillRecord,
  gap: GapRecord,
} as const;

/** A profile record type, such as `evidence`. */
export type ProfileRecordType = keyof typeof PROFILE_RECORD_SCHEMAS;

/** Any v0.1 profile record, told apart by its `schema` field. */
export type ProfileRecord = PharoamRecord | EvidenceRecord | SkillRecord | GapRecord;

/** One field that failed validation. */
export interface FieldIssue {
  /** Where the field is, such as `["entries", 2, "level"]`. */
  readonly path: readonly (string | number)[];
  /** Zod's code for the problem, such as `too_small`, for choosing a plain explanation. */
  readonly code: string;
  /** Zod's description, in English. */
  readonly message: string;
}

/**
 * Why a top block isn't a valid profile record.
 *
 * @remarks
 * - `unknown-schema`: `schema` is missing or doesn't name a profile record type and version;
 * - `unsupported-version`: a format version this Pharoam can't read, such as one written by a newer Pharoam;
 * - `invalid-fields`: the type is known but fields are missing or wrong.
 */
export type ProfileRecordError =
  | { readonly kind: "unknown-schema"; readonly schema: unknown }
  | { readonly kind: "unsupported-version"; readonly type: ProfileRecordType; readonly version: number }
  | { readonly kind: "invalid-fields"; readonly issues: readonly FieldIssue[] };

const CURRENT_VERSION = 1;

/**
 * Checks a record's top block against the schema it declares.
 *
 * @remarks Fields the schema doesn't know are left out of the result but stay in the file (MVP S12.4).
 * @param top - The top block's fields, as read by `parseRecordFile`.
 * @returns The typed record, or why it isn't valid.
 */
export function parseProfileRecord(
  top: Readonly<Record<string, unknown>>,
): Result<ProfileRecord, ProfileRecordError> {
  const { schema } = top;
  const match = typeof schema === "string" ? /^([a-z]+(?:-[a-z]+)*)\/([1-9]\d*)$/.exec(schema) : null;
  const type = match?.[1];
  if (match === null || type === undefined || !isProfileRecordType(type)) {
    return err({ kind: "unknown-schema", schema });
  }
  const version = Number(match[2]);
  if (version !== CURRENT_VERSION) return err({ kind: "unsupported-version", type, version });

  const result = (PROFILE_RECORD_SCHEMAS[type] as z.ZodType<ProfileRecord>).safeParse(top);
  if (result.success) return ok(result.data);
  const issues = result.error.issues.map((issue) => ({
    path: issue.path.map((key) => (typeof key === "number" ? key : String(key))),
    code: issue.code,
    message: issue.message,
  }));
  return err({ kind: "invalid-fields", issues });
}

function isProfileRecordType(type: string): type is ProfileRecordType {
  return Object.hasOwn(PROFILE_RECORD_SCHEMAS, type);
}
