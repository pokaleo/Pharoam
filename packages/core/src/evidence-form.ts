/**
 * The evidence form: which fields each kind of evidence asks for, and the record a filled form becomes.
 *
 * @remarks Every form makes the same shape of record (PRD B1, B4): `schema: evidence/1`, a new ID, `source: manual`
 * and `ai: null`, then the answers in a fixed order, with the description as the body (data model §7, MVP S4).
 * The record is validated before it is shown, so the preview is exactly what will be stored. Field names are the
 * record's; their labels come from the app's translation files (hard rule 12).
 * @packageDocumentation
 */
import { createRecordFile, type RecordFile } from "./record-file.ts";
import { err, ok, type Result } from "./result.ts";
import { parseProfileRecord, type ProfileRecordError } from "./schemas/profile-record.ts";

/** The kinds of evidence the form offers in v0.1, in the order it offers them (MVP §3). */
export const EVIDENCE_FORM_KINDS = ["project", "job", "module", "certificate", "other"] as const;

/** A kind of evidence the form offers; `module` is a course or module. */
export type EvidenceFormKind = (typeof EVIDENCE_FORM_KINDS)[number];

const COMMON_FIELDS = [
  "title",
  "organisation",
  "date",
  "start",
  "end",
  "links",
  "skills",
  "description",
] as const;

const KIND_FIELDS = {
  project: ["role"],
  job: ["role"],
  module: ["course_code", "credits", "grade"],
  certificate: ["issuer", "credential_id", "expires"],
  other: ["role"],
} as const satisfies Record<EvidenceFormKind, readonly string[]>;

/** A field on the evidence form. */
export type EvidenceFormField =
  (typeof COMMON_FIELDS)[number] | (typeof KIND_FIELDS)[EvidenceFormKind][number];

/**
 * What the person filled in on the evidence form.
 *
 * @remarks Empty answers are left out of the record, and answers to fields the chosen kind doesn't have are
 * ignored, so switching kinds part-way through never stores a stray field.
 */
export interface EvidenceForm {
  /** The kind of evidence. */
  readonly kind: EvidenceFormKind;
  /** What it was, such as a job title or a project's name. */
  readonly title: string;
  /** Where it was done: an employer, university or issuer. */
  readonly organisation?: string;
  /** When it happened, for something on one day or month, such as `2024-09-30`, `2024-09` or `2024`. */
  readonly date?: string;
  /** When it started, to the year, month or day. */
  readonly start?: string;
  /** When it ended, to the year, month or day. */
  readonly end?: string;
  /** Web links (`http` or `https`) to the work or a record of it. */
  readonly links?: readonly string[];
  /** The skills it involved, by inventory slug (data model §9). */
  readonly skills?: readonly string[];
  /** What the person did, in their own words, as Markdown. */
  readonly description?: string;
  /** For a project, job or other: the person's role. */
  readonly role?: string;
  /** For a module: its course code. */
  readonly course_code?: string;
  /** For a module: its credits. */
  readonly credits?: number;
  /** For a module: the grade. */
  readonly grade?: string;
  /** For a certificate: who issued it. */
  readonly issuer?: string;
  /** For a certificate: its credential ID. */
  readonly credential_id?: string;
  /** For a certificate: when it expires. */
  readonly expires?: string;
}

/** Why a filled form can't be stored; each field issue names the form field to fix (MVP S4.4). */
export interface InvalidEvidenceError {
  /** Always `"invalid"`. */
  readonly kind: "invalid";
  /** What is wrong, by field. */
  readonly error: ProfileRecordError;
}

/**
 * The fields the form shows for a kind of evidence (MVP S4.1).
 *
 * @param kind - The kind the person picked.
 * @returns The common fields, then the kind's own, in the order the form shows them.
 */
export function evidenceFormFields(kind: EvidenceFormKind): readonly EvidenceFormField[] {
  return [...COMMON_FIELDS, ...KIND_FIELDS[kind]];
}

/**
 * Turns a filled form into the evidence record it will be stored as (MVP S4.2, S4.3).
 *
 * @remarks Text is stored as typed, HTML included; it is shown as text, never run (hard rule 10).
 * @param form - The person's answers.
 * @param id - The new record's UUIDv7.
 * @param now - The time, as Pharoam writes it, such as `2026-10-29T09:30:00Z`.
 * @returns The record file, or the fields to fix.
 */
export function evidenceDraft(
  form: EvidenceForm,
  id: string,
  now: string,
): Result<RecordFile, InvalidEvidenceError> {
  const top: Record<string, unknown> = {
    schema: "evidence/1",
    id,
    created: now,
    updated: now,
    ai: null,
    kind: form.kind,
  };
  for (const field of evidenceFormFields(form.kind)) {
    if (field === "description") continue;
    const value = answer(form[field]);
    if (value !== undefined) top[field] = value;
  }
  top.source = "manual";
  const description = form.description ?? "";
  const body = description === "" || description.endsWith("\n") ? description : `${description}\n`;
  const file = createRecordFile(top, body);
  const record = parseProfileRecord(file.top);
  return record.ok ? ok(file) : err({ kind: "invalid", error: record.error });
}

// An answer as stored: `undefined` when empty, and lists without their empty entries. An empty title is left out
// too, so validation reports it as missing.
function answer(value: string | number | readonly string[] | undefined): unknown {
  if (Array.isArray(value)) {
    const filled = value.filter((item) => item !== "");
    return filled.length === 0 ? undefined : filled;
  }
  return value === "" ? undefined : value;
}
