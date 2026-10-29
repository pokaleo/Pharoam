/**
 * The readable text Pharoam writes into the person's files, in their language.
 *
 * @remarks The core holds no interface text (hard rule 12), so the app gives it these writers, built from the
 * translation files. Dates and lists follow the translation file's `app.locale`, such as `en-GB` for "3 Oct 2026".
 * @packageDocumentation
 */
import type { GapFacts, GapGroup, GapItem, GapWriter, OverviewFacts, OverviewWriter } from "@pharoam/core";
import type { TFunction } from "i18next";

const GROUPS: readonly GapGroup[] = ["supported", "claimed", "below", "unknown"];

/**
 * Creates the writer for the overview section of `pharoam.md` (MVP S3.3).
 *
 * @param t - The translation function.
 * @returns A writer that turns the counts and the last change into Markdown.
 */
export function overviewWriter(t: TFunction): OverviewWriter {
  const date = new Intl.DateTimeFormat(t("app.locale"), { day: "numeric", month: "short", year: "numeric" });
  return (facts: OverviewFacts) => {
    const lines =
      facts.evidence === 0 && facts.skills === 0
        ? [t("overview.nothing")]
        : [t("overview.evidence", { count: facts.evidence }), t("overview.skills", { count: facts.skills })];
    if (facts.lastChange !== undefined) {
      lines.push(t("overview.lastChange", { date: date.format(new Date(facts.lastChange)) }));
    }
    return [
      `## ${t("overview.title")}`,
      "",
      t("overview.note"),
      "",
      ...lines.map((line) => `- ${line}`),
    ].join("\n");
  };
}

/**
 * Creates the writer for a stored gap's summary, `gaps/<pathway>.md` (MVP S11.4).
 *
 * @remarks Lists requirements under their group, with what the pathway asks for and what the profile shows, and
 * the source of every level; there is no score or total (Charter R1), and a claimed level is never called verified
 * (MVP S11.7, R6).
 * @param t - The translation function.
 * @param levelName - The name of a level 0–4, from the content pack's level scale.
 * @returns A writer that turns the gap into Markdown.
 */
export function gapWriter(t: TFunction, levelName: (level: number) => string): GapWriter {
  const list = new Intl.ListFormat(t("app.locale"), { type: "conjunction" });
  const level = (value: number): string => t("gapSummary.level", { name: levelName(value), level: value });

  const line = (item: GapItem): string => {
    const asks = t("gapSummary.asks", {
      skill: item.name,
      importance: t(`gapSummary.importance.${item.importance}`),
      level: level(item.required),
    });
    if (item.shown === null) return `- ${asks}`;
    const cited = item.evidence.filter((e) => e.title !== undefined).map((e) => e.title ?? "");
    if (item.evidence.some((e) => e.title === undefined)) cited.push(t("gapSummary.removedEvidence"));
    const shows = t(cited.length === 0 ? "gapSummary.shows" : "gapSummary.showsCiting", {
      level: level(item.shown.level),
      source: t(`gapSummary.source.${item.shown.provenance}`),
      evidence: list.format(cited),
    });
    return `- ${asks} ${shows}`;
  };

  return (gap: GapFacts) => {
    const sections = GROUPS.flatMap((group) => {
      const items = gap.requirements.filter((item) => item.group === group);
      if (items.length === 0) return [];
      return ["", `### ${t(`gapSummary.group.${group}`)}`, "", ...items.map(line)];
    });
    return [
      `## ${t("gapSummary.title", { pathway: gap.title })}`,
      "",
      t("gapSummary.note"),
      ...sections,
    ].join("\n");
  };
}
