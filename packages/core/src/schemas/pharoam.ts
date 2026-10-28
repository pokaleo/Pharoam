/**
 * The `pharoam` record: the one central record about the person, `pharoam.md`.
 *
 * @remarks It has no field for a name, photo, contact details or exact location, so Pharoam can never write them
 * (hard rule 8, data model §10). The body holds the person's "About me" and an overview Pharoam regenerates.
 * @packageDocumentation
 */
import { z } from "zod";
import { ENVELOPE_FIELDS, PathwaySlugField, SkillSlugField, TextField } from "./fields.ts";

/** The `pharoam/1` record's top block. */
export const PharoamRecord = z.object({
  schema: z.literal("pharoam/1"),
  ...ENVELOPE_FIELDS,
  /** The person's own one-line summary. */
  headline: z.string().optional(),
  /** What the person is doing now, and in which field. */
  situation: z
    .object({
      stage: z.literal(["studying", "working", "between-roles", "changing-career"]),
      field: TextField.optional(),
    })
    .optional(),
  /** The country only, as an ISO 3166-1 two-letter code, such as `GB`; never a more exact location. */
  region: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  /** The pathways and skills the person is exploring now. */
  focus: z
    .object({
      pathways: z.array(PathwaySlugField).default([]),
      skills: z.array(SkillSlugField).default([]),
    })
    .optional(),
  /** How Pharoam works for this person. Never holds an API key. */
  preferences: z
    .object({
      mode: z.literal(["minimal", "ai-assisted"]).default("minimal"),
      /** The interface language as a BCP 47 tag, such as `en-GB`. */
      language: z
        .string()
        .regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
        .optional(),
      /** The chosen model provider, such as `anthropic`. */
      model_provider: z.string().min(1).optional(),
    })
    .optional(),
});

/** A `pharoam` record as Pharoam reads it. */
export type PharoamRecord = z.output<typeof PharoamRecord>;
