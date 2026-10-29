/**
 * The skill view: each of the person's skills once, with its one shown level, narrowed by domain or search.
 *
 * @remarks The level and its source come from each skill record's `proficiency` summary, which Pharoam
 * regenerates whenever it saves the record (MVP S9, PRD C4). Names and domains come from the vocabulary; a custom
 * skill has its own name and no domain (MVP S8.2).
 * @packageDocumentation
 */
import { isCustomSkill } from "./custom-skills.ts";
import type { ProfileRecord } from "./schemas/profile-record.ts";
import type { Proficiency } from "./schemas/skill-record.ts";
import type { SkillEntry } from "./schemas/skill.ts";

/** One skill in the view (MVP S9.1). */
export interface SkillViewItem {
  /** The skill's slug. */
  readonly skill: string;
  /** Its name: the vocabulary's, the person's own for a custom skill, or the slug for a skill no longer listed. */
  readonly name: string;
  /** Whether the person added it themselves, so it is marked as their own (MVP S8.2). */
  readonly custom: boolean;
  /** Its domain in the vocabulary, such as `programming`. */
  readonly domain?: string;
  /** The one shown level, its source and since when; absent when no observation counts. */
  readonly shown?: NonNullable<Proficiency["shown"]>;
  /** A newer claim that differs from a tested shown level, shown as a note on the level. */
  readonly newerClaim?: NonNullable<Proficiency["newer-claim"]>;
  /** Where the skill record is stored. */
  readonly location: string;
}

/** How to narrow the skill view (MVP S9.3). */
export interface SkillFilter {
  /** Only skills in this vocabulary domain. */
  readonly domain?: string;
  /** Only skills whose name, other names or slug contain this text, ignoring case and accents. */
  readonly query?: string;
}

/**
 * Lists the person's skills, by name (MVP S9.1, S9.3).
 *
 * @param records - The profile's valid records, with where each is stored.
 * @param vocabulary - The skills in the content pack.
 * @param filter - How to narrow the list; without one, every skill is listed.
 * @returns One item per skill record, sorted by name.
 */
export function skillView(
  records: readonly { readonly location: string; readonly record: ProfileRecord }[],
  vocabulary: readonly SkillEntry[],
  filter: SkillFilter = {},
): readonly SkillViewItem[] {
  const query = searchable(filter.query ?? "");
  const entries = new Map(vocabulary.map((entry) => [entry.slug as string, entry]));
  const items: SkillViewItem[] = [];
  for (const { location, record } of records) {
    if (record.schema !== "skill-record/1") continue;
    const entry = entries.get(record.skill);
    if (filter.domain !== undefined && entry?.domain !== filter.domain) continue;
    const name = entry?.name ?? record.name ?? record.skill;
    const names = [name, record.skill, ...(entry?.aliases ?? [])];
    if (query !== "" && !names.some((n) => searchable(n).includes(query))) continue;
    const { shown, "newer-claim": newerClaim } = record.proficiency ?? {};
    items.push({
      skill: record.skill,
      name,
      custom: isCustomSkill(record.skill),
      ...(entry !== undefined && { domain: entry.domain }),
      ...(shown !== undefined && { shown }),
      ...(newerClaim !== undefined && { newerClaim }),
      location,
    });
  }
  return items.toSorted((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

// Text as compared in a search: without accents, case or surrounding spaces.
function searchable(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();
}
