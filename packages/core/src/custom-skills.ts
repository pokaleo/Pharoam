/**
 * The person's own skills: those the vocabulary is missing, kept apart from the inventory by their slug.
 *
 * @remarks A custom skill's slug starts with `custom-`, which no inventory skill may, so it is marked as the
 * person's own wherever it appears and never matches a pathway requirement (MVP S8, data model §6).
 * @packageDocumentation
 */

const PREFIX = "custom-";

// Long enough for a readable name, short enough that `-` and an 8-digit short ID still fit the 64-character slug.
const MAX_NAME_PART = 64 - PREFIX.length - 9;

/**
 * Whether a skill is one the person added themselves (MVP S8.2).
 *
 * @param skill - The skill's slug.
 * @returns `true` for a `custom-` slug.
 */
export function isCustomSkill(skill: string): boolean {
  return skill.startsWith(PREFIX);
}

/**
 * The slug for a custom skill with this name (MVP S8.1).
 *
 * @remarks Lowercase letters and digits joined by single hyphens; accents are dropped and anything else becomes a
 * hyphen, so `KDB+/q` becomes `custom-kdb-q`. Room is left for a short ID, for when the slug is already taken.
 * @param name - The name the person gave the skill.
 * @returns The slug, or `undefined` if the name has no letters or digits a slug can hold, such as `日本語`.
 */
export function customSkillSlug(name: string): string | undefined {
  const part = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_NAME_PART)
    .replace(/-+$/, "");
  return part === "" ? undefined : `${PREFIX}${part}`;
}
