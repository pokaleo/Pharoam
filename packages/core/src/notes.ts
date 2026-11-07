/**
 * Notes: AI explanations of a gap that the person accepted (MVP S18, data model §10).
 *
 * @remarks Pure functions the core service uses: they build the call and the note's record, and read a note's text
 * back. A note is written only when the person accepts it (PRD D2), and never rewritten (S18.4).
 * @packageDocumentation
 */
import type { z } from "zod";
import { explainGap } from "./ai/tasks/explain-gap.ts";
import type { PreparedCall } from "./ai/task.ts";
import type { GapView } from "./core-service.ts";
import type { GapItem } from "./gaps.ts";
import type { ContentPack } from "./pack.ts";
import type { PathwayDetail } from "./pathways.ts";
import { createRecordFile, type RecordFile } from "./record-file.ts";
import type { AiProvenance } from "./schemas/fields.ts";

/** The call that would explain the gap to a pathway, prepared but not sent (MVP S18.1). */
export interface GapExplanationCall {
  /** The pathway, pinned to its pack version as the stored gap pins it. */
  readonly pathway: string;
  /** The stored gap's `updated` time, which the note keeps (S18.5). */
  readonly gapUpdated: string;
  /** The gap it explains, brought up to date first, for the app to show beside the explanation. */
  readonly gap: GapView;
  /** The task's input. */
  readonly input: z.output<typeof explainGap.input>;
  /** Exactly what will be sent, for the notice before sending (PRD D4). */
  readonly call: PreparedCall;
}

/** Which gap an explanation is of, and where it came from, for saving it as a note. */
export interface ExplainedGap {
  /** The pathway, pinned to its pack version, from {@link GapExplanationCall}. */
  readonly pathway: string;
  /** The `updated` time of the gap it explained, from {@link GapExplanationCall}. */
  readonly gapUpdated: string;
  /** The `ai` block from the task's answer: the task, the model and when it answered. */
  readonly ai: AiProvenance;
}

/** The latest note on a gap, as the gap view shows it (MVP S18.5). */
export interface GapNote {
  /** The note's ID. */
  readonly id: string;
  /** Where the note is stored. */
  readonly location: string;
  /** When the person accepted it. */
  readonly created: string;
  /** Where the explanation came from, and when the person accepted it. */
  readonly ai: AiProvenance;
  /** The explanation, as the person accepted or edited it, without the disclaimer above it. */
  readonly text: string;
  /** Whether the gap has changed since the one the note explained, so the profile has moved on. */
  readonly outOfDate: boolean;
}

/**
 * Builds the call that explains a gap (MVP S18.1).
 *
 * @param pathway - The pathway, as `pathwayDetail` gives it.
 * @param requirements - Where the person stands against each requirement, as the gap view shows it.
 * @param scale - Pharoam's shared level scale.
 * @returns The task's input; prepare it with `prepareCall`.
 */
export function gapExplanationInput(
  pathway: PathwayDetail,
  requirements: readonly GapItem[],
  scale: ContentPack["levels"]["levels"],
): z.output<typeof explainGap.input> {
  return {
    pathway: { title: pathway.title, summary: pathway.summary },
    scale,
    requirements: requirements.map(({ skill, name, importance, required, shown, group, evidence }) => ({
      skill,
      name,
      importance,
      required,
      shown,
      group,
      // A deleted record's title is gone; its ID would tell the model nothing.
      evidence: evidence.flatMap(({ title }) => (title === undefined ? [] : [title])),
    })),
  };
}

/**
 * Turns an accepted explanation into the note it will be stored as (MVP S18.4).
 *
 * @remarks The `ai` block is confirmed by the person at `now` (data model §5), and the disclaimer goes at the top
 * of the body, so the note's AI origin is clear outside Pharoam too (PRD D6).
 * @param gap - Which gap it explains, and the `ai` block.
 * @param text - The explanation, as the person accepted or edited it.
 * @param id - The note's UUIDv7.
 * @param now - When the person accepted it, as Pharoam writes times.
 * @param disclaimer - The disclaimer, in the person's language, from the app's translation files.
 * @returns The record file, still to be validated.
 * @throws Error when the disclaimer is blank, which is a bug in the app: every note must carry one (hard rule 6).
 */
export function gapNoteFile(
  gap: ExplainedGap,
  text: string,
  id: string,
  now: string,
  disclaimer: string,
): RecordFile {
  const top = {
    schema: "note/1",
    id,
    created: now,
    ai: { ...gap.ai, confirmed_by_user: now },
    pathway: gap.pathway,
    gap_updated: gap.gapUpdated,
  };
  const line = disclaimer.replace(/\s+/g, " ").trim();
  if (line === "") throw new Error("A note needs its disclaimer.");
  const notice = `> ⚠️ ${line}`;
  return createRecordFile(top, `${notice}\n\n${text.trim()}\n`);
}

// The disclaimer Pharoam writes at the top of a note's body: a quote that starts with the warning sign, which some
// editors save without its emoji variation selector. Blank lines around it go too, but not the text's indentation.
const DISCLAIMER = /^\s*> ⚠\uFE0F?[^\n]*(?:\n>[^\n]*)*(?:\n[ \t]*(?=\n))*\n?/u;

/**
 * A note's explanation, without the disclaimer Pharoam wrote above it.
 *
 * @remarks Anything else is kept as written, so a note edited outside Pharoam reads as the person left it.
 * @param body - The Markdown below the note's top block, as stored.
 * @returns The body after the disclaimer, without trailing blank lines.
 */
export function noteText(body: string): string {
  return body.replace(DISCLAIMER, "").trimEnd();
}
