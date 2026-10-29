/**
 * The descriptions shown beside each level when the person records one.
 *
 * @remarks Every skill uses the one shared scale of levels 0–4 (Charter P14, PRD C2). A skill may describe what
 * each level means for it; that description is shown instead of the shared one, under the shared level's name
 * (MVP S6.3).
 * @packageDocumentation
 */
import type { LevelScale } from "./schemas/levels.ts";
import type { SkillEntry } from "./schemas/skill.ts";

/** A level 0–4 on the shared scale. */
export type Level = 0 | 1 | 2 | 3 | 4;

/** What one level means, as shown when recording a level. */
export interface LevelDescription {
  /** The level, 0–4. */
  readonly level: Level;
  /** The shared level's short name, such as `Working`. */
  readonly name: string;
  /** What someone at this level can do: the skill's own description, or the shared one. */
  readonly description: string;
  /** Whether the description is the skill's own rather than the shared one. */
  readonly specific: boolean;
}

const LEVELS: readonly Level[] = [0, 1, 2, 3, 4];

/**
 * Describes each level for one skill (MVP S6.3).
 *
 * @param scale - The shared level scale, from the content pack.
 * @param skill - The skill from the vocabulary, or `undefined` for one that isn't in it, such as a custom skill.
 * @returns Levels 0 to 4, in order.
 */
export function levelDescriptions(
  scale: LevelScale,
  skill: SkillEntry | undefined,
): readonly LevelDescription[] {
  return LEVELS.map((level) => {
    const shared = scale.levels[level];
    const own = skill?.levels?.[level];
    return own === undefined
      ? { level, name: shared.name, description: shared.description, specific: false }
      : { level, name: shared.name, description: own, specific: true };
  });
}
