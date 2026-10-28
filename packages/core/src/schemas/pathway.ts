/**
 * The `pathway` content record: a career pathway's requirements, investment and review.
 *
 * @remarks Every requirement and figure has a source, and a pathway ships only after review (PRD I2, I3). Its
 * requirements name inventory skills only, never custom ones (MVP S8.3).
 * @packageDocumentation
 */
import { z } from "zod";
import {
  AiProvenance,
  CalendarDateField,
  HttpUrlField,
  InventorySkillSlugField,
  LevelField,
  PathwaySlugField,
  TextField,
} from "./fields.ts";

/** Where a requirement or figure comes from. */
export const SourceRef = z.object({
  title: TextField,
  url: HttpUrlField.optional(),
  /** When a web source was read. */
  accessed: CalendarDateField.optional(),
});

const SOURCES = z.array(SourceRef).min(1);

// A low-to-high range: `max` is reported when it's below `min`.
function checkRange(range: { min: number; max: number }, ctx: z.RefinementCtx): void {
  if (range.max < range.min)
    ctx.addIssue({ code: "custom", path: ["max"], message: "The maximum is below the minimum." });
}

/** One skill a pathway requires, at a level, as core or helpful. */
export const PathwayRequirement = z.object({
  skill: InventorySkillSlugField,
  level: LevelField,
  importance: z.literal(["core", "helpful"]),
  sources: SOURCES,
});

/** The `pathway/1` record's top block. */
export const PathwayRecord = z.object({
  schema: z.literal("pathway/1"),
  slug: PathwaySlugField,
  title: TextField,
  summary: TextField,
  requirements: z
    .array(PathwayRequirement)
    .min(1)
    .superRefine((requirements, ctx) => {
      const seen = new Set<string>();
      requirements.forEach((requirement, index) => {
        if (seen.has(requirement.skill)) {
          ctx.addIssue({ code: "custom", path: [index, "skill"], message: "Each skill is required once." });
        }
        seen.add(requirement.skill);
      });
    }),
  prerequisites: z.array(TextField).default([]),
  /** Skills from other pathways that carry over to this one. */
  transferable: z.array(InventorySkillSlugField).default([]),
  /** What is uncertain about this pathway, stated plainly. */
  uncertainties: z.array(TextField).default([]),
  /** Time and money to follow the pathway, as sourced ranges. */
  investment: z
    .object({
      time: z
        .object({
          min: z.number().nonnegative(),
          max: z.number().nonnegative(),
          unit: z.literal(["hours", "weeks", "months", "years"]),
          sources: SOURCES,
        })
        .superRefine(checkRange)
        .optional(),
      cost: z
        .object({
          min: z.number().nonnegative(),
          max: z.number().nonnegative(),
          /** An ISO 4217 currency code, such as `GBP`. */
          currency: z.string().regex(/^[A-Z]{3}$/),
          /** The country the costs apply to, as an ISO 3166-1 two-letter code. */
          region: z
            .string()
            .regex(/^[A-Z]{2}$/)
            .optional(),
          sources: SOURCES,
        })
        .superRefine(checkRange)
        .optional(),
    })
    .optional(),
  /** Linked ESCO occupations. */
  occupations: z
    .array(z.string().regex(/^http:\/\/data\.europa\.eu\/esco\/occupation\/[0-9a-f-]+$/))
    .default([]),
  sources: z.array(SourceRef).default([]),
  /** Who reviewed the pathway and when (PRD I3, MVP S10.2). */
  review: z.object({ by: TextField, at: CalendarDateField }),
  /** Set when AI drafted the pathway (MVP S10.3). */
  ai: AiProvenance.nullable().default(null),
});

/** A pathway as Pharoam reads it. */
export type PathwayRecord = z.output<typeof PathwayRecord>;
