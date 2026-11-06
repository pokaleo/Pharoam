/**
 * Turning pasted text, such as a CV or a list of modules, into evidence records (MVP S15, PRD B3–B5).
 *
 * @packageDocumentation
 */
import { z } from "zod";
import { EVIDENCE_FORM_KINDS, type EvidenceForm } from "../../evidence-form.ts";
import { defineTask } from "../task.ts";

/**
 * The most text one call reads: a long CV.
 *
 * @remarks The answer repeats much of the text in the person's own words, so the text is kept well under what a
 * provider lets a model write back in one answer (8,192 tokens for Anthropic). Longer text is refused before
 * anything is sent, so the person can paste it a part at a time.
 */
export const MAX_PASTED_CHARACTERS = 20_000;

// Optional answers accept `null` and empty text, which some models send for a field they leave out; such answers
// are dropped before the record is drafted, and the record's own schema checks the rest.
const text = (description: string): z.ZodOptional<z.ZodNullable<z.ZodString>> =>
  z.string().nullable().describe(description).optional();

/**
 * One record the model found, in the evidence form's shape (MVP S15.2).
 *
 * @remarks Only the form's fields: anything else the model adds, such as a level, a score or skills, is dropped, so
 * normalised evidence carries no level (S15.8, Charter R4); skill links come from their own task (S16). Dates and
 * links are only described here, not enforced: each record is then checked against the evidence schema on its own,
 * so one malformed date leaves that record to fix instead of losing the whole answer.
 */
export const NormalisedEvidence = z.object({
  kind: z
    .literal(EVIDENCE_FORM_KINDS)
    .describe("job, project, module (a course or module), certificate, or other (such as a degree)"),
  title: z.string().regex(/\S/).describe("What it was: a job title, a project's name or a module's name"),
  organisation: text("The employer, university or issuer"),
  date: text("For something on one day or month: YYYY, YYYY-MM or YYYY-MM-DD"),
  start: text("When it started: YYYY, YYYY-MM or YYYY-MM-DD"),
  end: text("When it ended: YYYY, YYYY-MM or YYYY-MM-DD; left out if it is ongoing"),
  links: z
    .array(z.string())
    .nullable()
    .describe("Web links the text gives for it, starting http:// or https://")
    .optional(),
  description: text("What the person did, in their own words from the text, as Markdown"),
  role: text("For a job, project or other: the person's role"),
  course_code: text("For a module: its course code"),
  credits: z.number().nonnegative().nullable().describe("For a module: its credits").optional(),
  grade: text("For a module: the grade"),
  issuer: text("For a certificate: who issued it"),
  credential_id: text("For a certificate: its credential ID"),
  expires: text("For a certificate: when it expires, as YYYY, YYYY-MM or YYYY-MM-DD"),
});

/** One record the model found. */
export type NormalisedEvidence = z.output<typeof NormalisedEvidence>;

/**
 * A record the model found, as the evidence form holds it, for the preview and for editing (MVP S15.2, S15.3).
 *
 * @param record - One record from the task's answer.
 * @returns The same answers, with those the model didn't give left out.
 */
export function formOfNormalised(record: NormalisedEvidence): EvidenceForm {
  // The answer's fields are exactly the form's, so only those left out, as nothing, null or empty text, are dropped.
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  ) as unknown as EvidenceForm;
}

const INSTRUCTIONS = [
  "You turn a person's pasted text, such as a CV or a list of course modules, into evidence records:",
  "one record for each job, project, course module, certificate or other piece of work or study it describes.",
  "Use only what the text says, and never invent details, dates, links, grades or organisations.",
  "Leave a field out when the text doesn't give it.",
  "Keep the person's own wording, in the language they wrote it, for the description and every field.",
  "Never give a level, a score or any judgement of the person's skills.",
  "If the text describes no work or study, answer with no records.",
].join(" ");

/**
 * Reads pasted text and answers with the evidence records it describes (MVP S15).
 *
 * @remarks Reads the pasted text only (S15.1, PRD D4), sent as marked data, so instructions inside it are material,
 * not commands (S15.7, security §3). It answers in the text's own language, since the records are the person's own
 * words, not Pharoam's. Nothing is written from the answer until the person has checked each record
 * and confirmed (S15.2–S15.5, hard rule 6).
 */
export const normaliseEvidence = defineTask({
  name: "normalise-evidence",
  version: 1,
  input: z.object({ text: z.string().regex(/\S/).max(MAX_PASTED_CHARACTERS) }),
  output: z.object({ records: z.array(NormalisedEvidence).max(100) }),
  instructions: () => INSTRUCTIONS,
  data: ({ text: pasted }) => [{ kind: "pasted-text", text: pasted }],
  answerIn: "material",
});
