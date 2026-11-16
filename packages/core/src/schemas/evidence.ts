/**
 * The `evidence` record: something the person studied or did, linked to skills.
 *
 * @remarks Evidence carries no level (Charter R4): levels live only in skill records. Each kind has the common
 * fields plus its own (data model §7, MVP S4.1).
 * @packageDocumentation
 */
import { z } from "zod";
import {
  ConfirmedAiProvenance,
  ENVELOPE_FIELDS,
  HttpUrlField,
  IntegrityField,
  InventorySkillSlugField,
  LevelField,
  PartialDateField,
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
      steps: z.array(DiagnosticStep).default([]),
      /** The level the diagnostic gave. */
      result: LevelField.optional(),
      /** The published rule that gave it, for a question-bank diagnostic (PRD E2). */
      rule: z.string().min(1).optional(),
      /** The record's fingerprint, so a change made outside Pharoam shows (data model §4). */
      integrity: IntegrityField.optional(),
      signature: z.null().optional(),
    }),
  ])
  .superRefine((record, ctx) => {
    // Compare to the shorter precision, so `2024-09` to `2024` is fine but `2024-09` to `2023` isn't.
    if (record.start === undefined || record.end === undefined) return;
    const length = Math.min(record.start.length, record.end.length);
    if (record.end.slice(0, length) < record.start.slice(0, length)) {
      ctx.addIssue({ code: "custom", path: ["end"], message: "The end is before the start." });
    }
  });

/** An `evidence` record as Pharoam reads it. */
export type EvidenceRecord = z.output<typeof EvidenceRecord>;
