/**
 * The words for levels, their sources and their dates, as the skill screens show them.
 *
 * @packageDocumentation
 */
import type { ContentPack, Provenance } from "@pharoam/core";
import type { TFunction } from "i18next";

/**
 * The name of a level, from the content pack's shared scale.
 *
 * @remarks The name always leads; the number only follows it (the design system's levels).
 * @param content - The content pack.
 * @param level - The level, 0–4.
 * @returns Its name, such as "Working", or the number when the scale has no such level.
 */
export function levelName(content: ContentPack | undefined, level: number): string {
  const scale: Readonly<Record<number, { readonly name: string } | undefined>> | undefined =
    content?.levels.levels;
  return scale?.[level]?.name ?? String(level);
}

/**
 * The words on a link to a skill's question-bank diagnostic.
 *
 * @remarks A level the person gave, or a model judged, is checked; with no level, or one a diagnostic already
 * tested, a diagnostic is taken (MVP S21.1).
 * @param t - The translation function.
 * @param state - Whether a diagnostic of the skill is in progress, and where its shown level came from, if it has
 * one.
 * @returns "Continue the diagnostic", "Check it with a diagnostic" or "Take a diagnostic".
 */
export function diagnosticLabel(
  t: TFunction,
  state: { readonly inProgress: boolean; readonly shown?: Provenance },
): string {
  if (state.inProgress) return t("skills.skillPage.continue");
  return state.shown === "self-reported" || state.shown === "ai-judged"
    ? t("skills.skillPage.check")
    : t("skills.skillPage.take");
}

/**
 * What a link to a skill's AI-led diagnostic says, the same way as {@link diagnosticLabel}: continue one in
 * progress, check a level the person or a model gave, get a more accurate result after a question-bank one, run it
 * again after an AI-led one, or take one (MVP S21.1–S21.3, S23).
 *
 * @param t - The translation function.
 * @param state - Whether an AI-led diagnostic of the skill is in progress, and where its shown level came from, if
 * it has one.
 * @returns The link's words, such as "Check it with an AI-led diagnostic".
 */
export function aiDiagnosticLabel(
  t: TFunction,
  state: { readonly inProgress: boolean; readonly shown?: Provenance },
): string {
  if (state.inProgress) return t("skills.skillPage.aiContinue");
  // After a question-bank result, more accuracy; after an AI-led one, again (MVP S21.2, S21.3).
  if (state.shown === "demonstrated") return t("skills.skillPage.aiMoreAccurate");
  if (state.shown === "ai-correlated") return t("skills.skillPage.aiAgain");
  return state.shown === "self-reported" || state.shown === "ai-judged"
    ? t("skills.skillPage.aiCheck")
    : t("skills.skillPage.aiTake");
}

/**
 * The name of a level's source, in the person's language.
 *
 * @param t - The translation function.
 * @param provenance - Where the level came from.
 * @returns The design system's fixed word for it, such as "Self-reported".
 */
export function sourceName(t: TFunction, provenance: Provenance): string {
  return t(`skills.sources.${provenance}`);
}

/**
 * A day in words, such as "3 Oct 2026".
 *
 * @remarks A calendar date (`2026-10-03`) is read as that day wherever the person is; a time is shown on the day it
 * fell where they are.
 * @param t - The translation function, for the locale.
 * @param value - A calendar date or a time, as records store them.
 * @returns The day in words.
 */
export function dayName(t: TFunction, value: string): string {
  const calendarDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat(t("app.locale"), {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(calendarDate ? { timeZone: "UTC" } : {}),
  }).format(new Date(value));
}
