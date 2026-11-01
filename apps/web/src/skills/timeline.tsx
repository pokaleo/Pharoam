/**
 * A skill's history as a timeline: one entry per level and per retraction, newest first.
 *
 * @packageDocumentation
 */
import type { ContentPack, HistoryItem, Provenance } from "@pharoam/core";
import { FilePen, Pencil, Undo2 } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Tag } from "../ui/tag.tsx";
import { dayName, levelName } from "./labels.ts";
import { Level } from "./level.tsx";
import { SourceTag } from "./source-tag.tsx";

/** The dot an entry carries: its level's source, or `retracted` for an entry that no longer counts. */
export type TimelineDot = Provenance | "retracted";

// Tested results filled in the channel, AI-made ones dashed, claims in their wash, and entries that no longer count
// hollow (the design system's history timeline).
const DOTS: Record<TimelineDot, string> = {
  "self-reported": "border-src-self bg-src-self-wash",
  "ai-judged": "border-dashed border-ai-edge bg-ground",
  demonstrated: "border-src-demo bg-src-demo",
  "ai-correlated": "border-dashed border-src-demo bg-src-demo-wash",
  retracted: "border-ink-3 bg-ground",
};

/**
 * The list that holds a timeline's entries.
 *
 * @param props - The list's accessible name, and its entries.
 * @returns The named list.
 */
export function Timeline({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <ul aria-label={label} className="grid">
      {children}
    </ul>
  );
}

/**
 * One entry on the timeline: its dot, the line down to the next entry, its date, and what happened.
 *
 * @remarks The dot repeats what the source tag beside it says, so screen readers skip it.
 * @param props - The entry's dot, its date in words, and what happened.
 * @returns The list item.
 */
export function TimelineEntry({
  dot,
  when,
  children,
}: {
  readonly dot: TimelineDot;
  readonly when: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <li className="relative ps-6 pb-(--space-4) before:absolute before:start-[5px] before:top-3.5 before:bottom-0 before:border-s before:border-line last:pb-0 last:before:hidden">
      <span
        aria-hidden="true"
        className={`absolute start-0 top-[5px] size-[11px] rounded-full border-2 ${DOTS[dot]}`}
      />
      <span className="block text-meta text-ink-3">{when}</span>
      {children}
    </li>
  );
}

/**
 * What one level in the history is: its source, the level, and its marks.
 *
 * @remarks Marks the level shown, a corrected or retracted one (struck through, since it no longer counts), and one
 * edited outside Pharoam (MVP S7.3, S12.3).
 * @param props - The history item and the content pack, for the level's name.
 * @returns The line of tags and the level.
 */
export function ObservationLine({
  item,
  content,
}: {
  readonly item: Extract<HistoryItem, { readonly kind: "observation" }>;
  readonly content: ContentPack;
}): ReactElement {
  const { t } = useTranslation();
  const observation = item.entry;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <SourceTag provenance={observation.provenance} />
      <Level
        level={observation.level}
        name={levelName(content, observation.level)}
        source={observation.provenance}
        struck={item.status !== "counts"}
      />
      {item.shown ? <Tag tone="shown">{t("skills.skillPage.shownMark")}</Tag> : null}
      {item.status === "superseded" ? <Tag icon={Pencil}>{t("skills.skillPage.superseded")}</Tag> : null}
      {item.status === "retracted" ? <Tag icon={Undo2}>{t("skills.skillPage.retracted")}</Tag> : null}
      <OutsideMark item={item} />
    </p>
  );
}

/**
 * What one retraction in the history is: the mark, and which level it retracted.
 *
 * @param props - The history item, and the whole history, where the retracted level is found by its ID.
 * @returns The line with the retraction and its note.
 */
export function ReviewLine({
  item,
  history,
}: {
  readonly item: Extract<HistoryItem, { readonly kind: "review" }>;
  readonly history: readonly HistoryItem[];
}): ReactElement {
  const { t } = useTranslation();
  const target = history.find(
    (other) => other.kind === "observation" && other.entry.id === item.entry.target,
  );
  // A level missing from the history (its file edited by hand) is named by its ID.
  const date = target?.kind === "observation" ? dayName(t, target.entry.observed_at) : item.entry.target;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <Tag icon={Undo2}>{t("skills.skillPage.retracted")}</Tag>
      <span>
        {item.entry.note === undefined
          ? t("skills.skillPage.retraction", { date })
          : t("skills.skillPage.retractionNote", { date, note: item.entry.note })}
      </span>
      <OutsideMark item={item} />
    </p>
  );
}

// The mark on an entry whose file was edited outside Pharoam, so it no longer carries Pharoam's fingerprint.
function OutsideMark({ item }: { readonly item: HistoryItem }): ReactElement | null {
  const { t } = useTranslation();
  return item.integrity.kind === "intact" ? null : (
    <Tag icon={FilePen}>{t("skills.skillPage.editedOutside")}</Tag>
  );
}
