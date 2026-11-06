/**
 * Evidence made from pasted text: the record a confirmed draft is stored as, and how to tell it is already there.
 *
 * @packageDocumentation
 */
import { evidenceDraft, type EvidenceForm, type InvalidEvidenceError } from "./evidence-form.ts";
import { withTopFields, type RecordFile } from "./record-file.ts";
import { err, ok, type Result } from "./result.ts";
import { parseProfileRecord } from "./schemas/profile-record.ts";
import type { AiProvenance } from "./schemas/fields.ts";

/** The name each record's own copy of the pasted text is kept under, beside the record (data model §7–8). */
export const ORIGINAL_INPUT = "original-input.txt";

/** Where a draft came from, and what the person chose for it. */
export interface PasteProvenance {
  /** The `ai` block from the task's answer: the task, the model and when it answered. */
  readonly ai: AiProvenance;
  /** The disclaimer for the top of the body, in the person's language, from the app's translation files. */
  readonly disclaimer: string;
  /** Whether the record keeps its own copy of the pasted text, unless the person chose to discard it (PRD B5). */
  readonly keepOriginal: boolean;
}

/**
 * Turns a draft from pasted text into the evidence record it will be stored as (MVP S15.5).
 *
 * @remarks The same record the form makes (S4.2), with `source: paste`, an `ai` block confirmed by the person at
 * `now` (data model §5), and the disclaimer at the top of the body, so its AI origin is clear outside Pharoam
 * too (PRD D6). When the original is kept, it is named in `original_input` and listed under `attachments`; storing
 * the file is the service's job. It carries no level (Charter R4).
 * @param form - The draft's answers, as the model gave them or as the person edited them.
 * @param id - The new record's UUIDv7.
 * @param now - When the person confirmed it, as Pharoam writes times.
 * @param paste - The `ai` block, the disclaimer, and whether the original is kept.
 * @returns The record file, or the fields to fix.
 */
export function pastedEvidence(
  form: EvidenceForm,
  id: string,
  now: string,
  paste: PasteProvenance,
): Result<RecordFile, InvalidEvidenceError> {
  const draft = evidenceDraft(form, id, now);
  if (!draft.ok) return draft;
  const fields = {
    ai: { ...paste.ai, confirmed_by_user: now },
    source: "paste",
    ...(paste.keepOriginal && { attachments: [ORIGINAL_INPUT], original_input: ORIGINAL_INPUT }),
  };
  const notice = `> ⚠️ ${paste.disclaimer}\n`;
  const body = draft.value.body === "" ? notice : `${notice}\n${draft.value.body}`;
  const file = { ...withTopFields(draft.value, fields), body };
  const record = parseProfileRecord(file.top);
  return record.ok ? ok(file) : err({ kind: "invalid", error: record.error });
}

/** What two pieces of evidence are compared by. */
export interface EvidenceIdentity {
  /** The kind of evidence. */
  readonly kind: string;
  /** What it was. */
  readonly title: string;
  /** Where it was done, if anywhere. */
  readonly organisation?: string;
}

/**
 * Whether a draft looks like evidence the person already has: the same kind, title and organisation (MVP S15.4).
 *
 * @remarks Case, accents written two ways and spacing are ignored, as a person reading them would. A matching draft
 * is left out unless the person puts it back, so pasting the same CV twice doesn't double the evidence.
 * @param a - One piece of evidence.
 * @param b - The other.
 * @returns `true` when they match.
 */
export function isSameEvidence(a: EvidenceIdentity, b: EvidenceIdentity): boolean {
  return (
    a.kind === b.kind &&
    comparable(a.title) === comparable(b.title) &&
    comparable(a.organisation ?? "") === comparable(b.organisation ?? "")
  );
}

function comparable(text: string): string {
  return text.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}
