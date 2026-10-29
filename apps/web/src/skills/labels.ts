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
