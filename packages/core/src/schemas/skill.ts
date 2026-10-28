/**
 * The `skill` content record: one entry in Pharoam's skill inventory.
 *
 * @remarks Profiles name skills only by these slugs; cross-references to ESCO, Wikidata and GitHub topics live
 * here, so profiles never need rewriting when a mapping changes (data model §9, §11).
 * @packageDocumentation
 */
import { z } from "zod";
import { HttpUrlField, InventorySkillSlugField, SpdxIdField, TextField } from "./fields.ts";

/** The `skill/1` record's top block. */
export const SkillEntry = z
  .object({
    schema: z.literal("skill/1"),
    slug: InventorySkillSlugField,
    name: TextField,
    /** Other names people search for, such as `Python 3`. */
    aliases: z.array(TextField).default([]),
    description: z.string().optional(),
    domain: TextField,
    /** Skills this one implies knowing, and skills related to it. */
    relations: z
      .object({
        implies: z.array(InventorySkillSlugField).default([]),
        related: z.array(InventorySkillSlugField).default([]),
      })
      .prefault({}),
    /**
     * What each level 0–4 means for this skill; without it, the shared level descriptions apply (MVP S6.3).
     *
     * @remarks v0.1 describes only the skills the pathways require (MVP §3).
     */
    levels: z.object({ 0: TextField, 1: TextField, 2: TextField, 3: TextField, 4: TextField }).optional(),
    refs: z
      .object({
        esco: z
          .string()
          .regex(/^http:\/\/data\.europa\.eu\/esco\/skill\/[0-9a-f-]+$/)
          .optional(),
        wikidata: z
          .string()
          .regex(/^Q[1-9]\d*$/)
          .optional(),
        github_topic: z
          .string()
          .regex(/^[a-z0-9][a-z0-9-]{0,49}$/)
          .optional(),
      })
      .optional(),
    /** Where the entry came from and under which licence (PRD I1). */
    origin: z.object({ source: TextField, url: HttpUrlField.optional(), licence: SpdxIdField }),
    status: z.literal(["active", "deprecated"]).default("active"),
    replaced_by: InventorySkillSlugField.optional(),
  })
  .superRefine((entry, ctx) => {
    // A deprecated skill points to its replacement, so old profiles keep working (data model §11).
    if (entry.status === "deprecated" && entry.replaced_by === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["replaced_by"],
        message: "A deprecated skill needs a replacement.",
      });
    }
  });

/** A skill inventory entry as Pharoam reads it. */
export type SkillEntry = z.output<typeof SkillEntry>;
