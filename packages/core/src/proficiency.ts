/**
 * The `proficiency` block: the generated summary at the top of each skill file.
 *
 * @remarks Pharoam regenerates it from the skill's history whenever it saves the file, so the shown level can be
 * read in Obsidian or Notion without Pharoam (MVP S9.2, data model §6). It is a summary, never a source: the
 * history decides, and no level is ever blended from several entries (Charter R4).
 * @packageDocumentation
 */
import type { Observation, Review } from "./schemas/skill-record.ts";
import { countingObservations, shownObservation } from "./skill-history.ts";

/** A level and the day it was observed, as the summary writes it. */
export interface LevelSince {
  /** The level, 0–4. */
  readonly level: number;
  /** The day of the observation, as written in its `observed_at`, such as `2026-10-24`. */
  readonly since: string;
}

/** The summary as Pharoam writes it into the skill file's top block. */
export interface ProficiencySummary {
  /** The one shown level, its source, since when, and the observation behind it. */
  readonly shown: LevelSince & {
    readonly provenance: Observation["provenance"];
    readonly observation: string;
  };
  /** A newer claim that differs from a tested shown level: a note on the level, never the level. */
  readonly "newer-claim"?: LevelSince & { readonly provenance: "self-reported" | "ai-judged" };
  /** The latest counting level from each source that has one. */
  readonly "by-source": Readonly<Partial<Record<Observation["provenance"], LevelSince>>>;
}

const SOURCES = ["self-reported", "ai-judged", "demonstrated", "ai-correlated"] as const;

/**
 * Summarises a skill's history (MVP S9.2, data model §6).
 *
 * @remarks When the shown level is tested, the latest claim newer than it is noted as `newer-claim`, but only if
 * it differs from the tested level: a later claim that agrees replaces an earlier one that didn't.
 * @param entries - The skill record's entries, in file order.
 * @returns The summary, or `undefined` when no observation counts.
 */
export function proficiencyOf(entries: readonly (Observation | Review)[]): ProficiencySummary | undefined {
  const shown = shownObservation(entries);
  if (shown === undefined) return undefined;
  const counting = countingObservations(entries);
  const bySource: Partial<Record<Observation["provenance"], LevelSince>> = {};
  for (const source of SOURCES) {
    const latest = latestOf(counting.filter((o) => o.provenance === source));
    if (latest !== undefined) bySource[source] = levelSince(latest);
  }
  const claim = newerClaim(shown, counting);
  // In the data model's order, which is the order the file shows them in.
  return {
    shown: { ...levelSince(shown), provenance: shown.provenance, observation: shown.id },
    ...(claim !== undefined && { "newer-claim": claim }),
    "by-source": bySource,
  };
}

// The latest claim newer than a tested shown level, if it differs from it.
function newerClaim(
  shown: Observation,
  counting: readonly Observation[],
): ProficiencySummary["newer-claim"] | undefined {
  if (shown.provenance !== "demonstrated" && shown.provenance !== "ai-correlated") return undefined;
  const after = Date.parse(shown.observed_at);
  const claim = latestOf(
    counting.filter(
      (o) =>
        (o.provenance === "self-reported" || o.provenance === "ai-judged") &&
        Date.parse(o.observed_at) > after,
    ),
  );
  if (claim === undefined || claim.level === shown.level) return undefined;
  const provenance = claim.provenance === "ai-judged" ? "ai-judged" : "self-reported";
  return { ...levelSince(claim), provenance };
}

// The latest by `observed_at` as an instant; of two at the same time, the one written later.
function latestOf(observations: readonly Observation[]): Observation | undefined {
  let latest: Observation | undefined;
  for (const o of observations)
    if (latest === undefined || Date.parse(o.observed_at) >= Date.parse(latest.observed_at)) latest = o;
  return latest;
}

function levelSince(observation: Observation): LevelSince {
  return { level: observation.level, since: observation.observed_at.slice(0, 10) };
}
