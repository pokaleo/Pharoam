/**
 * The overview in `pharoam.md`: a section Pharoam regenerates, kept apart from the person's own words.
 *
 * @remarks The section sits between two HTML comment markers, which most Markdown viewers, Obsidian included,
 * don't show; Pharoam's own renderer keeps raw HTML off and removes them (hard rule 10). Pharoam writes only
 * between the markers, so the person's text, before or after them, stays byte for byte as they wrote it (MVP
 * S3.2, data model §4, §10). The facts are counted here; the words come from the app's translation files
 * (hard rule 12).
 * @packageDocumentation
 */
import { err, ok, type Result } from "./result.ts";
import type { ProfileRecord } from "./schemas/profile-record.ts";

const START = "<!-- pharoam:overview -->";
const END = "<!-- /pharoam:overview -->";

/** What the overview reports about the profile (MVP S3.3). */
export interface OverviewFacts {
  /** How many evidence records there are. */
  readonly evidence: number;
  /** How many skills have a skill record. */
  readonly skills: number;
  /** The time of the latest change to evidence or skills, as written in the record, if there is any. */
  readonly lastChange: string | undefined;
}

/**
 * Turns the facts into the overview's Markdown, in the person's language.
 *
 * @remarks The app supplies it from its translation files, so the core holds no interface text (hard rule 12).
 */
export type OverviewWriter = (facts: OverviewFacts) => string;

/** Why the overview can't be written: its markers aren't one start followed by one end. */
export interface OverviewMarkersError {
  /** Always `"overview-markers"`. */
  readonly kind: "overview-markers";
}

/**
 * Counts the facts the overview reports.
 *
 * @remarks The last change is the latest evidence creation or edit, skill record creation, observation or
 * review, compared as instants, so times written with different offsets are ordered correctly.
 * @param records - The profile's valid records.
 * @returns The counts of evidence and skill records, and the time of the latest change.
 */
export function overviewFacts(records: readonly ProfileRecord[]): OverviewFacts {
  let evidence = 0;
  let skills = 0;
  let lastChange: string | undefined;
  const consider = (time: string | undefined): void => {
    if (time !== undefined && (lastChange === undefined || Date.parse(time) > Date.parse(lastChange)))
      lastChange = time;
  };
  for (const record of records) {
    if (record.schema === "evidence/1") {
      evidence += 1;
      consider(record.created);
      consider(record.updated);
    } else if (record.schema === "skill-record/1") {
      skills += 1;
      consider(record.created);
      for (const entry of record.entries)
        consider("observed_at" in entry ? entry.observed_at : entry.reviewed_at);
    }
  }
  return { evidence, skills, lastChange };
}

/**
 * Puts a new overview into the body of `pharoam.md`.
 *
 * @remarks Only the text between the markers is replaced. Without markers, the section is added after the
 * person's text, separated by a blank line. With broken markers (one missing, out of order or repeated), nothing
 * is changed: guessing where the section ends could overwrite the person's words (hard rule 3).
 * @param body - The body as it is now.
 * @param overview - The overview's Markdown, from the {@link OverviewWriter}.
 * @returns The new body, or `overview-markers` if the markers are broken.
 */
export function withOverview(body: string, overview: string): Result<string, OverviewMarkersError> {
  const content = overview.endsWith("\n") ? overview : `${overview}\n`;
  const starts = body.split(START).length - 1;
  const ends = body.split(END).length - 1;
  if (starts === 0 && ends === 0) {
    const gap = body === "" || body.endsWith("\n\n") ? "" : body.endsWith("\n") ? "\n" : "\n\n";
    return ok(`${body}${gap}${START}\n${content}${END}\n`);
  }
  const start = body.indexOf(START);
  const end = body.indexOf(END);
  if (starts !== 1 || ends !== 1 || end < start) return err({ kind: "overview-markers" });
  return ok(`${body.slice(0, start + START.length)}\n${content}${body.slice(end)}`);
}
