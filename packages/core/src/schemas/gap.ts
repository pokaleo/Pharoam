/**
 * The `gap` record: a stored gap analysis for one pathway, readable outside Pharoam.
 *
 * @remarks It groups each requirement and never scores, totals or ranks (Charter R1, PRD F3). Pharoam regenerates
 * it whenever the profile or pathway changes (data model §10).
 * @packageDocumentation
 */
import { z } from "zod";
import { ENVELOPE_FIELDS, LevelField, ProfileRecordIdField, Provenance, SkillSlugField } from "./fields.ts";

/** One pathway requirement and where the person stands against it. */
export const GapRequirement = z.object({
  skill: SkillSlugField,
  /** The level the pathway asks for. */
  required: LevelField,
  /** The skill's shown level and its source, or `null` when there is none. */
  shown: z.object({ level: LevelField, provenance: Provenance }).nullable().default(null),
  group: z.literal(["supported", "claimed", "below", "unknown"]),
  /** The evidence the shown level cites, listed for a claimed level (MVP S11.7). */
  evidence: z.array(ProfileRecordIdField).default([]),
});

/** The `gap/1` record's top block. */
export const GapRecord = z.object({
  schema: z.literal("gap/1"),
  ...ENVELOPE_FIELDS,
  /** The pathway pinned to its pack version, as `pack@version:pathway`, such as `pharoam-core@0.1.0:ml-engineer`. */
  pathway: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*@[0-9A-Za-z][0-9A-Za-z.+-]*:[a-z0-9]+(?:-[a-z0-9]+)*$/),
  requirements: z.array(GapRequirement),
});

/** A `gap` record as Pharoam reads it. */
export type GapRecord = z.output<typeof GapRecord>;
