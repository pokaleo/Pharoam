/**
 * The readable text Pharoam writes into the person's files, in their language.
 *
 * @remarks The core holds no interface text (hard rule 12), so the app gives it these writers, built from the
 * translation files. Dates and lists follow the translation file's `app.locale`, such as `en-GB` for "3 Oct 2026".
 * @packageDocumentation
 */
import type {
  AiAssessmentFacts,
  AiAssessmentWriter,
  AssessmentFacts,
  AssessmentWriter,
  GapFacts,
  GapGroup,
  GapItem,
  GapWriter,
  OverviewFacts,
  OverviewWriter,
} from "@pharoam/core";
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

/**
 * Creates the writer for a question-bank diagnostic's assessment record: its title and readable summary (MVP S19.5).
 *
 * @remarks The summary gives the result by the published rule and each question asked, right or not, so the record
 * reads well outside Pharoam; it is never a score (Charter R1), and says the person's evidence wasn't considered
 * (PRD E2).
 * @param t - The translation function.
 * @param levelName - The name of a level 0–4, from the content pack's level scale.
 * @returns A writer that turns the diagnostic into a title and Markdown.
 */
export function assessmentWriter(t: TFunction, levelName: (level: number) => string): AssessmentWriter {
  const level = (value: number): string =>
    t("diagnostic.record.level", { name: levelName(value), level: value });
  return (facts: AssessmentFacts) => {
    const steps = facts.steps.map((step, index) =>
      t(step.correct ? "diagnostic.record.right" : "diagnostic.record.wrong", {
        number: index + 1,
        item: step.item,
        level: level(step.level),
      }),
    );
    return {
      title: t("diagnostic.record.title", { skill: facts.name }),
      body: [
        `## ${t("diagnostic.record.title", { skill: facts.name })}`,
        "",
        t("diagnostic.record.result", {
          level: level(facts.result),
          rule: facts.rule,
          count: facts.steps.length,
        }),
        "",
        t("diagnostic.record.note"),
        "",
        ...steps.map((line) => `- ${line}`),
        "",
      ].join("\n"),
    };
  };
}

/**
 * Makes the writer for an AI-led diagnostic's assessment record: its title and a readable summary (MVP S23.4).
 *
 * @remarks The summary gives the result by the published rule, the explanation under the AI label and disclaimer
 * with the model that wrote it (hard rule 6), and every question in full with the answer and its marking, so the
 * record reads well outside Pharoam. It is never a score (Charter R1). The model's text and the person's answers
 * are kept as text: a line of theirs that would start a Markdown heading is escaped, so they can't add sections.
 * @param t - The translation function.
 * @param levelName - The name of a level 0–4, from the content pack's level scale.
 * @returns A writer that turns the diagnostic into a title and Markdown.
 */
export function aiAssessmentWriter(t: TFunction, levelName: (level: number) => string): AiAssessmentWriter {
  const level = (value: number): string =>
    t("diagnostic.record.level", { name: levelName(value), level: value });
  return (facts: AiAssessmentFacts) => {
    const { explanation } = facts;
    const section = (heading: string, lines: readonly string[]): string[] =>
      lines.length === 0 ? [] : [`### ${heading}`, "", ...lines, ""];
    const questions = facts.steps.map((step, index) => {
      const answer = step.format === "mcq" ? (step.options[step.answer] ?? String(step.answer)) : step.answer;
      const marking = t(step.correct ? "aiDiagnostic.record.right" : "aiDiagnostic.record.wrong");
      const source = t(step.source === "written" ? "aiDiagnostic.written" : "aiDiagnostic.bank");
      return [
        `- ${t("aiDiagnostic.record.question", { number: index + 1, level: level(step.level), source, marking })}`,
        indented(step.prompt),
        indented(t("aiDiagnostic.record.answer", { answer })),
        ...(step.format === "mcq" ? [] : [indented(t("aiDiagnostic.record.why", { reasons: step.reasons }))]),
      ].join("\n");
    });
    return {
      title: t("aiDiagnostic.record.title", { skill: facts.name }),
      body: [
        `## ${t("aiDiagnostic.record.title", { skill: facts.name })}`,
        "",
        t("aiDiagnostic.record.result", {
          level: level(facts.result),
          rule: facts.rule,
          count: facts.steps.length,
        }),
        "",
        t("aiDiagnostic.record.disclaimer", { model: explanation.ai.model }),
        "",
        ...section(t("aiDiagnostic.record.showed"), [plain(explanation.showed)]),
        ...section(t("aiDiagnostic.record.comparison"), [plain(explanation.comparison)]),
        ...section(
          t("aiDiagnostic.record.reasons"),
          explanation.reasons.map((reason) => `- ${plain(reason).replace(/\n/g, " ")}`),
        ),
        ...section(t("aiDiagnostic.record.nextStep"), [plain(explanation.next_step)]),
        ...section(t("aiDiagnostic.record.considered"), consideredLines(t, level, facts.considered)),
        ...section(t("aiDiagnostic.record.questions"), questions),
      ].join("\n"),
    };
  };
}

// What an AI-led diagnostic considered, one line each, or a line saying there was nothing.
function consideredLines(
  t: TFunction,
  level: (value: number) => string,
  considered: AiAssessmentFacts["considered"],
): string[] {
  const lines = [
    ...considered.evidence.map(({ title }) => t("aiDiagnostic.record.evidence", { title: plain(title) })),
    ...considered.claims.map(({ level: value, provenance, since }) =>
      t("aiDiagnostic.record.claim", {
        level: level(value),
        source: t(`skills.sources.${provenance}`),
        since,
      }),
    ),
    ...considered.earlier.map(({ level: value, date }) =>
      t("aiDiagnostic.record.earlier", { level: level(value), date }),
    ),
  ];
  return lines.length === 0 ? [t("aiDiagnostic.record.nothing")] : lines.map((line) => `- ${line}`);
}

// Text from the model or the person, kept as text: a line that would start a heading, underline the line above
// into one, draw a rule or open a code block is escaped, so it can't change the record's structure.
function plain(text: string): string {
  return text.trim().replace(/^(\s*)(#|=+\s*$|-+\s*$|```|~~~)/gm, "$1\\$2");
}

// Text kept inside the list item above it, every line indented under it.
function indented(text: string): string {
  return plain(text)
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}
