/**
 * The `evidence` record: something the person studied or did, linked to skills.
 *
 * @remarks Evidence carries no level (Charter R4): levels live only in skill records. Each kind has the common
 * fields plus its own (data model §7, MVP S4.1).
 * @packageDocumentation
 */
import { z } from "zod";
import { QUESTION_BANK_RULE, diagnosticResult } from "../diagnostic.ts";
import {
  AiProvenance,
  ConfirmedAiProvenance,
  ENVELOPE_FIELDS,
  HttpUrlField,
  IntegrityField,
  InventorySkillSlugField,
  LevelField,
  PartialDateField,
  ProfileRecordIdField,
  SentFingerprint,
  SkillSlugField,
  TextField,
} from "./fields.ts";

/** One question a question-bank diagnostic asked: the item, the option chosen, and whether it was right. */
export const DiagnosticStep = z.object({
  /** The item's slug in the question bank. */
  item: z.string().min(1),
  /** The level the item tests. */
  level: LevelField,
  /** The index of the option chosen. */
  answer: z.int().min(0),
  /** Whether it was the right option. */
  correct: z.boolean(),
});

/** One question a question-bank diagnostic asked, as Pharoam reads it. */
export type DiagnosticStep = z.output<typeof DiagnosticStep>;

const ASKED_FIELDS = {
  /** The level the question tests. */
  level: LevelField,
  /** The question or task, in full, as the person saw it. */
  prompt: TextField,
  /** The call that chose the bank item or wrote the question: every question is the model's choice (MVP S23.2). */
  chosen: AiProvenance,
  /** Why the model chose it: what it probes in the person's evidence and claims (ADR-0019). */
  why: TextField,
};

// A bank's multiple-choice item, which only the bank supplies: the model never writes one, and its answer is marked
// by the bank's key with no AI call, so it has no rubric and no model's marking (MVP S23.2).
const MCQ_FIELDS = {
  ...ASKED_FIELDS,
  source: z.literal("bank"),
  /** The item's slug in the question bank. */
  item: z.string().min(1),
  format: z.literal("mcq"),
  /** The options, in full, in the order shown. */
  options: z.array(TextField).min(2),
  rubric: z.never().optional(),
  reasons: z.never().optional(),
  marked: z.never().optional(),
};

// An open question or practical task: one of the bank's, or one the model wrote, with the rubric it is marked by.
const RUBRIC_FIELDS = {
  ...ASKED_FIELDS,
  source: z.literal(["bank", "written"]),
  /** The item's slug, for one reused from the bank. */
  item: z.string().min(1).optional(),
  format: z.literal(["open", "practical"]),
  /** What a right answer must show, in full. */
  rubric: TextField,
  options: z.never().optional(),
};

// A bank item names its slug; a written one has none, as no bank holds it.
function checkSource(
  asked: { source: "bank" | "written"; item?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  if (asked.source === "bank" && asked.item === undefined)
    ctx.addIssue({ code: "custom", path: ["item"], message: "A bank item names its slug." });
  if (asked.source === "written" && asked.item !== undefined)
    ctx.addIssue({ code: "custom", path: ["item"], message: "A written item isn't in the bank." });
}

// A multiple-choice answer is one of the options shown.
function checkOption(step: { options: readonly string[]; answer: number }, ctx: z.RefinementCtx): void {
  if (step.answer >= step.options.length)
    ctx.addIssue({ code: "custom", path: ["answer"], message: "The answer isn't one of the options shown." });
}

/**
 * A question an AI-led diagnostic posed, in full: a bank item the model chose, or an open question or practical
 * task it wrote (MVP S23.2).
 *
 * @remarks Held in full, not by slug alone, so the record reads without the pack and a written item, which no pack
 * has, can be asked again after a reload (S23.5).
 */
export const AiLedItem = z.discriminatedUnion("format", [
  z.object(MCQ_FIELDS),
  z.object(RUBRIC_FIELDS).superRefine(checkSource),
]);

/** A question an AI-led diagnostic posed, as Pharoam reads it. */
export type AiLedItem = z.output<typeof AiLedItem>;

/**
 * One question an AI-led diagnostic asked, in full, with the answer and its marking (MVP S23.4).
 *
 * @remarks A multiple-choice answer is the option chosen, marked by the bank's key with no AI call. Any other
 * answer is the person's text, which is never blank, marked by the model, so it keeps the marking's reasons and the
 * call that made it (hard rule 6).
 */
export const AiLedStep = z.discriminatedUnion("format", [
  z.object({ ...MCQ_FIELDS, answer: z.int().min(0), correct: z.boolean() }).superRefine(checkOption),
  z
    .object({
      ...RUBRIC_FIELDS,
      answer: TextField,
      correct: z.boolean(),
      /** Why the model marked it so. */
      reasons: TextField,
      /** The call that marked it. */
      marked: AiProvenance,
    })
    .superRefine(checkSource),
]);

/** One question an AI-led diagnostic asked, as Pharoam reads it. */
export type AiLedStep = z.output<typeof AiLedStep>;

/**
 * Any diagnostic's step: an AI-led one, or a question bank's.
 *
 * @remarks A step with a `format` is AI-led and is read only as one, so a broken AI-led step is refused for what is
 * wrong with it, never read as a question bank's step with its item in full dropped.
 */
export const AnyDiagnosticStep = z.union([
  AiLedStep,
  DiagnosticStep.extend({ format: z.never().optional() }),
]);

/** Any diagnostic's step, as Pharoam reads it. */
export type AnyDiagnosticStep = z.output<typeof AnyDiagnosticStep>;

/**
 * What an AI-led diagnostic's explanation says (MVP S23.3, PRD E5): what the session showed, how it compares with
 * the person's claims and evidence, up to three possible reasons, and a next step.
 *
 * @remarks It carries no level and no score (hard rule 9): the level is the published rule's. The task's own schema
 * drops anything else a model sends, so Pharoam never writes a score; a field added by hand is allowed, as on every
 * record (MVP S12.4), and counts for nothing.
 */
export const DiagnosticExplanation = z.object({
  /** What the session showed. */
  showed: TextField,
  /** How it compares with the person's claims and evidence, in either direction. */
  comparison: TextField,
  /** Likely reasons for a difference, offered as possibilities. */
  reasons: z.array(TextField).max(3).default([]),
  /** A next step. */
  next_step: TextField,
});

/** An AI-led diagnostic's explanation, as Pharoam reads it. */
export type DiagnosticExplanation = z.output<typeof DiagnosticExplanation>;

/**
 * What an AI-led diagnostic considered: the evidence, claims and earlier results it sent (MVP S23.3).
 *
 * @remarks Each piece of evidence keeps a fingerprint of what was sent about it, as a scan's does (S16.10), so a
 * change made since shows; the order is that of its references, `E1` first. Claims and earlier results are sealed
 * entries and records, so their IDs suffice.
 */
export const Considered = z.object({
  /** Each evidence record sent, with a fingerprint of what was sent about it. */
  evidence: z.array(z.object({ evidence: ProfileRecordIdField, sent: SentFingerprint })).default([]),
  /** The observations sent as the person's claims. */
  claims: z.array(ProfileRecordIdField).default([]),
  /** The earlier diagnostics' assessment evidence sent. */
  earlier: z.array(ProfileRecordIdField).default([]),
});

/** What an AI-led diagnostic considered, as Pharoam reads it. */
export type Considered = z.output<typeof Considered>;

/**
 * Whether each step suits its diagnostic: AI-led steps for an AI-led one, the bank's for a question bank's; and no
 * bank item asked twice.
 *
 * @remarks Shared by the session and the assessment evidence, which hold the same steps (data model §7, §10). A
 * diagnostic never asks an item it has asked (MVP S19.3, S23.2).
 * @param ai - Whether the diagnostic is AI-led.
 * @param steps - Its steps.
 * @param ctx - Where to add a problem.
 */
export function checkSteps(ai: boolean, steps: readonly AnyDiagnosticStep[], ctx: z.RefinementCtx): void {
  const asked = new Set<string>();
  steps.forEach((step, index) => {
    if ("source" in step !== ai)
      ctx.addIssue({
        code: "custom",
        path: ["steps", index],
        message: ai
          ? "An AI-led diagnostic holds each question in full."
          : "A question-bank diagnostic names each item by its slug.",
      });
    if (step.item === undefined) return;
    if (asked.has(step.item))
      ctx.addIssue({
        code: "custom",
        path: ["steps", index, "item"],
        message: "This item was already asked.",
      });
    asked.add(step.item);
  });
}

/**
 * A skill link AI proposed and the person confirmed (PRD B6).
 *
 * @remarks Listed beside `skills`, so the record shows which links came from AI without labelling the whole record
 * AI-made (data model §7).
 */
export const AiSkillLink = ConfirmedAiProvenance.extend({ skill: SkillSlugField });

const COMMON_FIELDS = {
  schema: z.literal("evidence/1"),
  ...ENVELOPE_FIELDS,
  title: TextField,
  organisation: TextField.optional(),
  date: PartialDateField.optional(),
  start: PartialDateField.optional(),
  end: PartialDateField.optional(),
  links: z.array(HttpUrlField).default([]),
  skills: z.array(SkillSlugField).default([]),
  "ai-skill-links": z.array(AiSkillLink).default([]),
  attachments: z.array(z.string().min(1)).default([]),
  source: z.literal(["manual", "paste", "import"]).default("manual"),
  original_input: z.string().min(1).optional(),
};

/** The `evidence/1` record's top block, by kind. */
export const EvidenceRecord = z
  .discriminatedUnion("kind", [
    z.object({
      ...COMMON_FIELDS,
      kind: z.literal("module"),
      course_code: TextField.optional(),
      credits: z.number().nonnegative().optional(),
      grade: TextField.optional(),
    }),
    z.object({ ...COMMON_FIELDS, kind: z.literal("degree"), grade: TextField.optional() }),
    z.object({
      ...COMMON_FIELDS,
      kind: z.literal("certificate"),
      issuer: TextField.optional(),
      credential_id: TextField.optional(),
      expires: PartialDateField.optional(),
    }),
    z.object({
      ...COMMON_FIELDS,
      kind: z.literal("repository"),
      url: HttpUrlField.optional(),
      role: TextField.optional(),
    }),
    z.object({
      ...COMMON_FIELDS,
      kind: z.literal(["job", "project", "publication", "reflection", "other"]),
      role: TextField.optional(),
    }),
    // A diagnostic's full record, never edited and fingerprinted (data model §4, §7, PRD E6). One written by hand
    // has none of the diagnostic's fields, and is still evidence.
    z.object({
      ...COMMON_FIELDS,
      kind: z.literal("assessment"),
      role: TextField.optional(),
      /** Which diagnostic, the skill it tested, and the level it started at. */
      diagnostic: z
        .object({
          type: z.literal(["question-bank", "ai-led"]),
          skill: InventorySkillSlugField,
          start: LevelField,
        })
        .optional(),
      /** Each question asked, in order, with the answer and its marking: the adaptive path. */
      steps: z.array(AnyDiagnosticStep).default([]),
      /** The level the diagnostic gave. */
      result: LevelField.optional(),
      /** The published rule that gave it, applied to the bank's answer key or to an AI-led diagnostic's markings. */
      rule: z.string().min(1).optional(),
      /** An AI-led diagnostic's: the evidence, claims and earlier results it sent. */
      considered: Considered.optional(),
      /** An AI-led diagnostic's explanation, written by the call its `ai` block names (PRD E5). */
      explanation: DiagnosticExplanation.optional(),
      /** The record's fingerprint, so a change made outside Pharoam shows (data model §4). */
      integrity: IntegrityField.optional(),
      signature: z.null().optional(),
    }),
  ])
  .superRefine((record, ctx) => {
    if (record.kind === "assessment" && record.diagnostic !== undefined) checkAssessment(record, ctx);
    // Compare to the shorter precision, so `2024-09` to `2024` is fine but `2024-09` to `2023` isn't.
    if (record.start === undefined || record.end === undefined) return;
    const length = Math.min(record.start.length, record.end.length);
    if (record.end.slice(0, length) < record.start.slice(0, length)) {
      ctx.addIssue({ code: "custom", path: ["end"], message: "The end is before the start." });
    }
  });

/** An `evidence` record as Pharoam reads it. */
export type EvidenceRecord = z.output<typeof EvidenceRecord>;

// What checkAssessment reads of an assessment record.
interface Assessment {
  readonly diagnostic?: { readonly type: "question-bank" | "ai-led" } | undefined;
  readonly steps: readonly AnyDiagnosticStep[];
  readonly considered?: unknown;
  readonly explanation?: unknown;
  readonly ai: unknown;
  readonly date?: string | undefined;
  readonly integrity?: string | undefined;
  readonly rule?: string | undefined;
  readonly result?: number | undefined;
}

// A diagnostic's record: steps of its own kind, and for an AI-led one everything S23.4 asks of it, with the level
// the published rule gives from its markings (S23.3).
function checkAssessment(record: Assessment, ctx: z.RefinementCtx): void {
  const ai = record.diagnostic?.type === "ai-led";
  checkSteps(ai, record.steps, ctx);
  const issue = (field: string, message: string) => {
    ctx.addIssue({ code: "custom", path: [field], message });
  };
  if (!ai) {
    if (record.considered !== undefined)
      issue("considered", "Only an AI-led diagnostic sends the person's material.");
    if (record.explanation !== undefined)
      issue("explanation", "Only an AI-led diagnostic is explained by a model.");
    return;
  }
  if (record.explanation === undefined) issue("explanation", "An AI-led result is explained.");
  if (record.considered === undefined) issue("considered", "An AI-led result lists what it considered.");
  if (record.ai === null) issue("ai", "An AI-led result names the call that explained it.");
  if (record.date === undefined) issue("date", "A diagnostic's record has the day it ended.");
  if (record.integrity === undefined) issue("integrity", "A diagnostic's record is fingerprinted.");
  if (record.rule !== QUESTION_BANK_RULE)
    issue("rule", `An AI-led result is given by ${QUESTION_BANK_RULE}.`);
  if (record.result !== diagnosticResult(record.steps))
    issue("result", "The result is the level the published rule gives from the markings.");
}
