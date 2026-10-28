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
  PartialDateField,
  SkillSlugField,
  TextField,
} from "./fields.ts";

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
      kind: z.literal(["job", "project", "publication", "reflection", "assessment", "other"]),
      role: TextField.optional(),
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
