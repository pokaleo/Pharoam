/**
 * The `assessment-item` content record: one question or task in the question bank.
 *
 * @remarks Items are AI-drafted and human-reviewed, each tagged with its skill and the level it tests (PRD I3, data
 * model §11). Multiple-choice items make up the question bank that question-bank diagnostics draw from (PRD E2);
 * open and practical items carry a rubric for AI-led diagnostics to mark against (PRD E3). An item ships only once
 * reviewed (MVP S20.1).
 * @packageDocumentation
 */
import { z } from "zod";
import { SLUG_PATTERN } from "../ids.ts";
import {
  AiProvenance,
  CalendarDateField,
  HttpUrlField,
  InventorySkillSlugField,
  LanguageTagField,
  LevelField,
  SpdxIdField,
  TextField,
} from "./fields.ts";

// Each one once: two the same would make an item ambiguous.
const distinct = (values: readonly unknown[]): boolean => new Set(values).size === values.length;

const COMMON = {
  schema: z.literal("assessment-item/1"),
  /** The item's slug, unique in the pack, such as `sql-2-joins`. */
  slug: z.string().regex(SLUG_PATTERN),
  /**
   * The skills it tests, by inventory slug, each once. The first is the one a diagnostic draws it for, and names the
   * folder it is kept in (`content/items/<skill>/`).
   */
  skills: z.array(InventorySkillSlugField).min(1).refine(distinct, "Each skill is named once."),
  /** The level it tests, 0–4. */
  level: LevelField,
  /** The question or task, as the person sees it. */
  prompt: TextField,
  /** The language of its text, as a BCP 47 tag. */
  language: LanguageTagField.default("en"),
  /** Where it came from and under which licence (PRD I3). */
  origin: z.object({ source: TextField, url: HttpUrlField.optional(), licence: SpdxIdField }),
  /** Who reviewed it and when; an item ships only once reviewed (MVP S20.1). */
  review: z.object({ by: TextField, at: CalendarDateField }),
  /** The AI block if it was drafted with AI (data model §5). */
  ai: AiProvenance.nullable().default(null),
};

/** A multiple-choice item: the question bank's kind (PRD E2). */
export const McqItem = z
  .object({
    ...COMMON,
    format: z.literal("mcq"),
    /** Two to six options, as the person sees them, each different. */
    options: z.array(TextField).min(2).max(6).refine(distinct, "Each option is different."),
    /** The index of the right option. */
    answer: z.int().min(0),
    /** Why that option is right, shown with the marking at the end (MVP S19.4). */
    explanation: TextField,
    /** Refused, so a mislabelled item fails instead of losing its marking guide. */
    rubric: z.never().optional(),
  })
  .refine((item) => item.answer < item.options.length, { path: ["answer"], message: "Names no option." });

/** An open or practical item, marked by AI review against its rubric (PRD E3, ADR-0014). */
export const RubricItem = z.object({
  ...COMMON,
  format: z.literal(["open", "practical"]),
  /** What a good answer shows, for the marking task. */
  rubric: TextField,
  /** Refused, so a multiple-choice item mislabelled as open fails instead of losing its options. */
  options: z.never().optional(),
  answer: z.never().optional(),
  explanation: z.never().optional(),
});

/** The `assessment-item/1` record, told apart by `format`, so a problem names its field. */
export const AssessmentItem = z.discriminatedUnion("format", [McqItem, RubricItem]);

/** An assessment item as Pharoam reads it. */
export type AssessmentItem = z.output<typeof AssessmentItem>;

/** A multiple-choice item as Pharoam reads it. */
export type McqItem = z.output<typeof McqItem>;

/** An open or practical item as Pharoam reads it. */
export type RubricItem = z.output<typeof RubricItem>;
