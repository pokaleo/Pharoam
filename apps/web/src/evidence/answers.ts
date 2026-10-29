/**
 * The evidence form's answers as the person types them, and what they become.
 *
 * @packageDocumentation
 */
import {
  evidenceFormFields,
  evidenceFormOf,
  type EvidenceForm,
  type EvidenceFormField,
  type EvidenceFormKind,
  type InvalidEvidenceError,
  type RecordFile,
} from "@pharoam/core";

/** The form's fields typed as one line of text. */
export type TextAnswer = Exclude<EvidenceFormField, "links" | "skills" | "description">;

/** What the person has typed and chosen, kept as typed so going back to the form loses nothing. */
export interface EvidenceAnswers {
  /** The kind of evidence. */
  readonly kind: EvidenceFormKind;
  /** The one-line answers, as typed. */
  readonly text: Readonly<Partial<Record<TextAnswer, string>>>;
  /** The links, one per line. */
  readonly links: string;
  /** The skills picked, by slug. */
  readonly skills: readonly string[];
  /** What the person did, as Markdown. */
  readonly description: string;
}

/** Answers for a new piece of evidence: a project, with nothing filled in. */
export const NO_ANSWERS: EvidenceAnswers = {
  kind: "project",
  text: {},
  links: "",
  skills: [],
  description: "",
};

/**
 * What to fix in each field, as translation keys under `evidence.errors`.
 *
 * @remarks Keyed by the form field; a field with more than one problem shows the first.
 */
export type FieldErrors = Readonly<Partial<Record<EvidenceFormField, FieldError>>>;

/** A problem with one field, named by its translation key. */
export type FieldError = "title" | "date" | "endBeforeStart" | "links" | "credits" | "text";

const DATE_FIELDS: readonly EvidenceFormField[] = ["date", "start", "end", "expires"];

/**
 * Turns the answers into the form the core stores, or says which answers can't be read.
 *
 * @remarks Only credits are checked here, since the core needs a number; everything else is checked by the core's
 * schema, so the rules live in one place.
 * @param answers - What the person typed and chose.
 * @returns The evidence form, or the fields to fix.
 */
export function evidenceFormFrom(answers: EvidenceAnswers): { form: EvidenceForm } | { errors: FieldErrors } {
  const text = (field: TextAnswer): string => (answers.text[field] ?? "").trim();
  const credits = text("credits");
  const number = Number(credits);
  if (credits !== "" && (!Number.isFinite(number) || number < 0)) return { errors: { credits: "credits" } };
  // Every field, whatever the kind: the core keeps only the kind's own and leaves out empty answers.
  return {
    form: {
      kind: answers.kind,
      title: text("title"),
      organisation: text("organisation"),
      date: text("date"),
      start: text("start"),
      end: text("end"),
      links: answers.links.split("\n").map((link) => link.trim()),
      skills: answers.skills,
      description: answers.description,
      role: text("role"),
      course_code: text("course_code"),
      ...(credits === "" ? {} : { credits: number }),
      grade: text("grade"),
      issuer: text("issuer"),
      credential_id: text("credential_id"),
      expires: text("expires"),
    },
  };
}

/**
 * The answers stored evidence gives, for editing it.
 *
 * @param file - The stored evidence.
 * @returns The answers, or `undefined` for evidence the form can't edit, such as a degree.
 */
export function answersOf(file: RecordFile): EvidenceAnswers | undefined {
  const form = evidenceFormOf(file);
  if (form === undefined) return undefined;
  const text: Partial<Record<TextAnswer, string>> = {};
  for (const field of evidenceFormFields(form.kind)) {
    if (field === "links" || field === "skills" || field === "description") continue;
    const value = form[field];
    if (value !== undefined) text[field] = String(value);
  }
  return {
    kind: form.kind,
    text,
    links: (form.links ?? []).join("\n"),
    skills: form.skills ?? [],
    description: form.description ?? "",
  };
}

/**
 * Turns the core's validation problems into what to fix in each field (MVP S4.4).
 *
 * @param error - Why the core refused the form.
 * @returns The problem with each field, by field.
 */
export function fieldErrorsOf(error: InvalidEvidenceError): FieldErrors {
  if (error.error.kind !== "invalid-fields") return { title: "text" };
  const errors: Partial<Record<EvidenceFormField, FieldError>> = {};
  for (const issue of error.error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || !isFormField(field) || errors[field] !== undefined) continue;
    errors[field] =
      field === "title"
        ? "title"
        : field === "end" && issue.code === "custom"
          ? "endBeforeStart"
          : DATE_FIELDS.includes(field)
            ? "date"
            : field === "links"
              ? "links"
              : field === "credits"
                ? "credits"
                : "text";
  }
  return errors;
}

const FORM_FIELDS = new Set<string>(
  (["project", "job", "module", "certificate", "other"] as const).flatMap((kind) => evidenceFormFields(kind)),
);

function isFormField(field: string): field is EvidenceFormField {
  return FORM_FIELDS.has(field);
}
