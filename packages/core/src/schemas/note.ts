/**
 * The `note` record: an AI explanation of a gap that the person accepted, as they accepted or edited it.
 *
 * @remarks Notes are never rewritten; asking again writes a new one (data model §10, MVP S18.4). The explanation is
 * the body, after the disclaimer, so it reads the same outside Pharoam (PRD D6).
 * @packageDocumentation
 */
import { z } from "zod";
import { ConfirmedAiProvenance, ENVELOPE_FIELDS, PinnedPathwayField, TimestampField } from "./fields.ts";

/** The `note/1` record's top block. */
export const NoteRecord = z.object({
  schema: z.literal("note/1"),
  ...ENVELOPE_FIELDS,
  /** Where the explanation came from, a version of `explain-gap`, and when the person accepted it (hard rule 6). */
  ai: ConfirmedAiProvenance.extend({ task: z.string().regex(/^explain-gap@[1-9]\d*$/) }),
  /** The pathway whose gap it explains, pinned to its pack version. */
  pathway: PinnedPathwayField,
  /** The `updated` time of the gap it explained, so a later change to the gap can be seen (MVP S18.5). */
  gap_updated: TimestampField,
});

/** A `note` record as Pharoam reads it. */
export type NoteRecord = z.output<typeof NoteRecord>;
