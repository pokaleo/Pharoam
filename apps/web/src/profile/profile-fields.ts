/**
 * The fields of `pharoam.md` the person fills in, as the profile form reads and writes them.
 *
 * @packageDocumentation
 */
import type { ProfileFields } from "@pharoam/core";

/** What the person is doing now, in the order the form offers them. */
export const STAGES = ["studying", "working", "between-roles", "changing-career"] as const;

/** What the person is doing now. */
export type Stage = (typeof STAGES)[number];

/**
 * Whether a value is one of the {@link STAGES}.
 *
 * @param value - The value from the form.
 * @returns True for a stage.
 */
export function isStage(value: string): value is Stage {
  return STAGES.some((stage) => stage === value);
}

/**
 * Reads the profile form's answers, leaving out what wasn't given.
 *
 * @remarks The field of work is kept only with a stage, which is where `pharoam.md` stores it (data model §10).
 * @param form - The submitted form.
 * @returns The headline, situation, country and pathways given.
 */
export function profileFieldsOf(form: FormData): ProfileFields {
  const text = (name: string): string => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const stage = text("stage");
  const field = text("field");
  const pathways = form.getAll("pathways").filter((value) => typeof value === "string");
  return {
    ...(text("headline") === "" ? {} : { headline: text("headline") }),
    ...(isStage(stage) ? { situation: field === "" ? { stage } : { stage, field } } : {}),
    ...(text("region") === "" ? {} : { region: text("region") }),
    ...(pathways.length === 0 ? {} : { focus: { pathways } }),
  };
}

/**
 * Adds back the focus the form can't show, so saving the form never drops it.
 *
 * @remarks The form lists only the pathways in the content pack and no skills; a pathway from another pack, or a
 * skill added in an editor, stays in `pharoam.md` (hard rule 3).
 * @param fields - The form's answers.
 * @param current - The focus in `pharoam.md` now.
 * @param shown - The slugs of the pathways the form offers.
 * @returns The answers, with the focus the form doesn't offer kept after the person's choices.
 */
export function withHiddenFocus(
  fields: ProfileFields,
  current: ProfileFields["focus"],
  shown: readonly string[],
): ProfileFields {
  const pathways = [
    ...(fields.focus?.pathways ?? []),
    ...(current?.pathways ?? []).filter((slug) => !shown.includes(slug)),
  ];
  const skills = current?.skills ?? [];
  const rest: ProfileFields = {
    ...(fields.headline === undefined ? {} : { headline: fields.headline }),
    ...(fields.situation === undefined ? {} : { situation: fields.situation }),
    ...(fields.region === undefined ? {} : { region: fields.region }),
  };
  if (pathways.length === 0 && skills.length === 0) return rest;
  return {
    ...rest,
    focus: { ...(pathways.length === 0 ? {} : { pathways }), ...(skills.length === 0 ? {} : { skills }) },
  };
}
