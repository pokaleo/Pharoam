/**
 * The skills a person can pick: the content pack's vocabulary and their own custom skills.
 *
 * @packageDocumentation
 */
import type { ContentPack, LoadedRecord } from "@pharoam/core";

/** A skill to pick, by name. */
export interface SkillChoice {
  /** Its slug, as records store it. */
  readonly slug: string;
  /** Its name. */
  readonly name: string;
  /** Other names it goes by, which find it too. */
  readonly aliases: readonly string[];
}

/**
 * Every skill the person can pick: the vocabulary, then their own custom skills (MVP S8.2).
 *
 * @param content - The content pack.
 * @param records - The profile's valid records, where custom skills have their skill records.
 * @returns The skills, vocabulary first.
 */
export function skillChoices(content: ContentPack, records: readonly LoadedRecord[]): readonly SkillChoice[] {
  const vocabulary = content.skills.map((skill) => ({
    slug: skill.slug,
    name: skill.name,
    aliases: skill.aliases,
  }));
  const custom = records.flatMap(({ record }) =>
    record.schema === "skill-record/1" &&
    record.name !== undefined &&
    !vocabulary.some((s) => s.slug === record.skill)
      ? [{ slug: record.skill, name: record.name, aliases: [] }]
      : [],
  );
  return [...vocabulary, ...custom];
}

/**
 * Finds the skill a person typed, by its name or another name, ignoring case and spaces at the ends.
 *
 * @param choices - The skills to look in.
 * @param typed - What the person typed.
 * @returns The skill, or `undefined` if no name matches.
 */
export function findSkill(choices: readonly SkillChoice[], typed: string): SkillChoice | undefined {
  const wanted = typed.trim().toLocaleLowerCase();
  if (wanted === "") return undefined;
  return choices.find((choice) =>
    [choice.name, ...choice.aliases].some((name) => name.toLocaleLowerCase() === wanted),
  );
}

/**
 * A skill's name, for showing a slug a record stores.
 *
 * @param choices - The skills to look in.
 * @param slug - The slug a record stores, such as `python`.
 * @returns Its name, or the slug itself when no skill has it, so nothing stored is ever hidden.
 */
export function skillName(choices: readonly SkillChoice[], slug: string): string {
  return choices.find((choice) => choice.slug === slug)?.name ?? slug;
}
