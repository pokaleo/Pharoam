/**
 * The gap to a pathway: each requirement grouped by the skill's shown level, with nothing scored.
 *
 * @remarks Groups follow MVP §3 (PRD F3): *supported* when a tested level meets the requirement, *claimed* when a
 * claimed level does, *below* when the shown level is lower, *unknown* when there is none. Only the required skill
 * itself counts, never a related one (Charter R4, R6), and there is no score, percentage, total or ranking (R1).
 * Supported means shown in a Pharoam diagnostic, never verified. The stored `gap` record's body is written by the
 * app in the person's language (hard rule 12).
 * @packageDocumentation
 */
import type { ProfileRecord } from "./schemas/profile-record.ts";
import type { Observation } from "./schemas/skill-record.ts";
import { shownObservation } from "./skill-history.ts";

/** Where the person stands against one requirement (PRD F3). */
export type GapGroup = "supported" | "claimed" | "below" | "unknown";

/** One requirement in the gap view (MVP S11.1, S11.2, S11.7). */
export interface GapItem {
  /** The required skill's slug, which also opens its history. */
  readonly skill: string;
  /** The skill's name. */
  readonly name: string;
  /** Whether the pathway marks it core or helpful. */
  readonly importance: "core" | "helpful";
  /** The level the pathway asks for. */
  readonly required: number;
  /** The skill's shown level and its source, or `null` when there is none. */
  readonly shown: { readonly level: number; readonly provenance: Observation["provenance"] } | null;
  /** Where the person stands against it. */
  readonly group: GapGroup;
  /** The evidence the shown level cites, with each title; a deleted record keeps only its ID (MVP S5.2). */
  readonly evidence: readonly { readonly id: string; readonly title?: string }[];
}

/** What the stored gap's readable summary reports (MVP S11.4). */
export interface GapFacts {
  /** The pathway's title. */
  readonly title: string;
  /** Each requirement, in the pathway's order. */
  readonly requirements: readonly GapItem[];
}

/**
 * Turns the gap into the stored record's Markdown body, in the person's language.
 *
 * @remarks The app supplies it from its translation files, so the core holds no interface text (hard rule 12). It
 * must not score or total the requirements (Charter R1), and labels a claimed level by its source (MVP S11.7).
 */
export type GapWriter = (gap: GapFacts) => string;

/** A pathway requirement, with its skill's name, as the gap needs it. */
interface Requirement {
  readonly skill: string;
  readonly name: string;
  readonly level: number;
  readonly importance: "core" | "helpful";
}

/**
 * Groups one requirement by the skill's shown level (MVP §3, PRD F3).
 *
 * @param required - The level the pathway asks for.
 * @param shown - The skill's shown level and its source, or `undefined` when there is none.
 * @returns Its group.
 */
export function gapGroup(
  required: number,
  shown: { readonly level: number; readonly provenance: Observation["provenance"] } | undefined,
): GapGroup {
  if (shown === undefined) return "unknown";
  if (shown.level < required) return "below";
  return shown.provenance === "demonstrated" || shown.provenance === "ai-correlated"
    ? "supported"
    : "claimed";
}

/**
 * Compares the profile with a pathway's requirements (MVP S11.1).
 *
 * @param pathway - The pathway's requirements, with skill names, as `pathwayDetail` gives them.
 * @param records - The profile's valid records.
 * @returns One item per requirement, in the pathway's order.
 */
export function gapItems(
  pathway: { readonly requirements: readonly Requirement[] },
  records: readonly ProfileRecord[],
): readonly GapItem[] {
  const titles = new Map<string, string>(
    records.flatMap((r) => (r.schema === "evidence/1" ? [[r.id, r.title] as const] : [])),
  );
  return pathway.requirements.map(({ skill, name, level, importance }) => {
    const record = records.find((r) => r.schema === "skill-record/1" && r.skill === skill);
    const observation = record?.schema === "skill-record/1" ? shownObservation(record.entries) : undefined;
    const shown =
      observation === undefined
        ? undefined
        : { level: observation.level, provenance: observation.provenance };
    const evidence = (observation?.evidence ?? []).map((id) => {
      const title = titles.get(id);
      return title === undefined ? { id } : { id, title };
    });
    return {
      skill,
      name,
      importance,
      required: level,
      shown: shown ?? null,
      group: gapGroup(level, shown),
      evidence,
    };
  });
}
