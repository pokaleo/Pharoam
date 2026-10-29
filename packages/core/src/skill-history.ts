/**
 * A skill's history: which observations count, the one level shown, and every entry newest first.
 *
 * @remarks Entries are only ever appended (hard rule 4). A correction is a new observation that `supersedes` an
 * earlier one, and a retraction is a review entry; superseded and retracted observations stay in the history but
 * never count (PRD C3, data model §6). The shown level is chosen by a fixed order, never blended from several
 * entries (Charter R4): the latest tested level, otherwise the latest accepted AI judgement, otherwise the latest
 * self-reported level. "Latest" compares `observed_at` as instants.
 * @packageDocumentation
 */
import type { IntegrityStatus } from "./integrity.ts";
import type { Observation, Review } from "./schemas/skill-record.ts";

/** Whether an observation counts, or why not. */
export type ObservationStatus = "counts" | "superseded" | "retracted";

/** One entry in a skill's history, as shown to the person (MVP S7.3, PRD C6). */
export type HistoryItem =
  | {
      readonly kind: "observation";
      readonly entry: Observation;
      /** Whether it counts, or was superseded or retracted. */
      readonly status: ObservationStatus;
      /** Whether it is the observation behind the shown level. */
      readonly shown: boolean;
      /** Whether it was edited outside Pharoam (MVP S12.3). */
      readonly integrity: IntegrityStatus;
    }
  | {
      readonly kind: "review";
      readonly entry: Review;
      /** Whether it was edited outside Pharoam (MVP S12.3). */
      readonly integrity: IntegrityStatus;
    };

type Entry = Observation | Review;

// The order a shown level is chosen in: tested levels first, then accepted AI judgements, then claims.
const RANK = { demonstrated: 0, "ai-correlated": 0, "ai-judged": 1, "self-reported": 2 } as const;

/**
 * Says whether each observation counts, or why not.
 *
 * @param entries - A skill record's entries, in file order.
 * @returns Each observation's status, by ID.
 */
export function observationStatuses(entries: readonly Entry[]): ReadonlyMap<string, ObservationStatus> {
  const retracted = new Set(entries.flatMap((e) => (isReview(e) ? [e.target] : [])));
  const superseded = new Set(
    entries.flatMap((e) => (!isReview(e) && e.supersedes !== undefined ? [e.supersedes] : [])),
  );
  return new Map(
    entries.flatMap((e) =>
      isReview(e)
        ? []
        : [
            [
              e.id,
              retracted.has(e.id) ? "retracted" : superseded.has(e.id) ? "superseded" : "counts",
            ] as const,
          ],
    ),
  );
}

/**
 * The observations that count: those neither superseded nor retracted (MVP S7.1, S7.2).
 *
 * @param entries - A skill record's entries, in file order.
 * @returns The counting observations, in file order.
 */
export function countingObservations(entries: readonly Entry[]): readonly Observation[] {
  const status = observationStatuses(entries);
  return entries.filter((e): e is Observation => !isReview(e) && status.get(e.id) === "counts");
}

/**
 * The observation behind the skill's shown level (data model §6).
 *
 * @param entries - A skill record's entries, in file order.
 * @returns The observation, or `undefined` if none counts.
 */
export function shownObservation(entries: readonly Entry[]): Observation | undefined {
  let shown: Observation | undefined;
  for (const observation of countingObservations(entries)) {
    if (
      shown === undefined ||
      RANK[observation.provenance] < RANK[shown.provenance] ||
      (RANK[observation.provenance] === RANK[shown.provenance] &&
        Date.parse(observation.observed_at) >= Date.parse(shown.observed_at))
    )
      shown = observation;
  }
  return shown;
}

/**
 * Every entry of a skill, newest first, each marked (MVP S7.3, PRD C6).
 *
 * @remarks Entries at the same time keep the file's order, the one written later first.
 * @param entries - A skill record's entries, in file order.
 * @param integrity - Each entry's integrity, in the same order.
 * @returns The history, newest first.
 */
export function skillHistory(
  entries: readonly Entry[],
  integrity: readonly IntegrityStatus[],
): readonly HistoryItem[] {
  const status = observationStatuses(entries);
  const shown = shownObservation(entries);
  const items = entries.map((entry, index): HistoryItem => {
    const checked = integrity[index] ?? { kind: "edited-outside", reason: "no-fingerprint" };
    return isReview(entry)
      ? { kind: "review", entry, integrity: checked }
      : {
          kind: "observation",
          entry,
          status: status.get(entry.id) ?? "counts",
          shown: entry === shown,
          integrity: checked,
        };
  });
  return items
    .map((item, index) => ({ item, index, at: Date.parse(timeOf(item.entry)) }))
    .toSorted((a, b) => b.at - a.at || b.index - a.index)
    .map(({ item }) => item);
}

function isReview(entry: Entry): entry is Review {
  return "decision" in entry;
}

function timeOf(entry: Entry): string {
  return isReview(entry) ? entry.reviewed_at : entry.observed_at;
}
