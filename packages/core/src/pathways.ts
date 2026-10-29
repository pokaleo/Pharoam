/**
 * Browsing pathways: the list the person picks from, and one pathway with its requirements in full.
 *
 * @remarks Pathways come from the content pack, where every requirement has a source and every pathway has been
 * reviewed (PRD I2, I3). A pathway AI drafted keeps its `ai` block, so the app can say so beside the reviewer
 * (MVP S10.3, PRD D6). Skill and level names are filled in from the pack, so the app shows names, not slugs.
 * @packageDocumentation
 */
import { levelDescriptions } from "./levels.ts";
import type { ContentPack } from "./pack.ts";
import type { PathwayRecord } from "./schemas/pathway.ts";

/** A pathway as the list shows it (MVP S10.1). */
export interface PathwaySummary {
  /** The pathway's slug, such as `ml-engineer`. */
  readonly slug: string;
  /** Its title. */
  readonly title: string;
  /** What the work is, in a sentence or two. */
  readonly summary: string;
  /** Who reviewed it and on which day. */
  readonly review: PathwayRecord["review"];
  /** How AI drafted it, or `null` if people wrote it. */
  readonly ai: PathwayRecord["ai"];
}

/** One requirement, with its skill's and level's names (MVP S10.2). */
export type PathwayRequirementView = PathwayRecord["requirements"][number] & {
  /** The skill's name in the vocabulary. */
  readonly name: string;
  /** The required level's name on the shared scale, such as `Proficient`. */
  readonly levelName: string;
};

/** A pathway in full, as its page shows it (MVP S10.2, S10.3). */
export type PathwayDetail = Omit<PathwayRecord, "requirements" | "transferable"> & {
  /** Each requirement, in the pathway's order. */
  readonly requirements: readonly PathwayRequirementView[];
  /** Skills that carry over from other pathways, with their names. */
  readonly transferable: readonly { readonly skill: string; readonly name: string }[];
};

/**
 * Lists the pathways in a pack (MVP S10.1).
 *
 * @param pack - The content pack.
 * @returns Each pathway's slug, title, summary, review and AI provenance, in the pack's order (by slug).
 */
export function pathwaySummaries(pack: ContentPack): readonly PathwaySummary[] {
  return pack.pathways.map(({ slug, title, summary, review, ai }) => ({ slug, title, summary, review, ai }));
}

/**
 * One pathway in full, with skill and level names filled in (MVP S10.2, S10.3).
 *
 * @param pack - The content pack.
 * @param slug - Which pathway, such as `ml-engineer`.
 * @returns The pathway, or `undefined` if the pack doesn't have it.
 */
export function pathwayDetail(pack: ContentPack, slug: string): PathwayDetail | undefined {
  const pathway = pack.pathways.find((p) => p.slug === slug);
  if (pathway === undefined) return undefined;
  const names = new Map<string, string>(pack.skills.map((s) => [s.slug, s.name]));
  const levelNames = levelDescriptions(pack.levels, undefined).map((level) => level.name);
  // A compiled pack has every skill its pathways name, and levels are 0–4, so these fallbacks are never used.
  const name = (skill: string): string => names.get(skill) ?? skill;
  return {
    ...pathway,
    requirements: pathway.requirements.map((requirement) => ({
      ...requirement,
      name: name(requirement.skill),
      levelName: levelNames[requirement.level] ?? String(requirement.level),
    })),
    transferable: pathway.transferable.map((skill) => ({ skill, name: name(skill) })),
  };
}
