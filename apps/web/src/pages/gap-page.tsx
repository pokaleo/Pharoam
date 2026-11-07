/**
 * The gap to a pathway (MVP S11).
 *
 * @packageDocumentation
 */
import {
  pathwayDetail,
  type ContentPack,
  type CoreService,
  type GapGroup,
  type GapItem,
  type GapView,
  type PathwayDetail,
} from "@pharoam/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Anchor,
  Circle,
  CloudFog,
  Diamond,
  FileText,
  Footprints,
  History,
  MessageSquareQuote,
  Paperclip,
  Plus,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { GapMeaning } from "../pathways/gap-meaning.tsx";
import { PathwayProvenance } from "../pathways/provenance.tsx";
import { useSession } from "../profile/session.tsx";
import { dayName, levelName } from "../skills/labels.ts";
import { Level } from "../skills/level.tsx";
import { SourceTag } from "../skills/source-tag.tsx";
import { Button, buttonClassName } from "../ui/button.tsx";
import { ChangedOutsideNotice } from "../ui/changed-outside.tsx";
import { Icon } from "../ui/icon.tsx";
import { Markdown } from "../ui/markdown.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";
import { TABLE } from "../ui/table.ts";
import { Tag, type TagTone } from "../ui/tag.tsx";

// The places to act come first: below and unknown, then claimed, then supported (the design system's gap view).
const GROUPS: readonly GapGroup[] = ["below", "unknown", "claimed", "supported"];

/** Why the gap couldn't be shown. */
type GapFailure = "unknown-pathway" | "changed-outside" | "failed";

/**
 * Compares the profile with a pathway, stores the result as `gaps/<pathway>.md`, and shows each requirement under
 * its group.
 *
 * @remarks Opening the page brings the stored gap up to date; the core writes only when it changed (MVP S11.4).
 * Requirements are grouped as supported, claimed, below or unknown by the skill's one shown level (MVP S11.1), with
 * that level, its source and the evidence it cites, and a link to the skill's history (MVP S11.2, S11.7). There is
 * no score, percentage, total or ranking, and no count per group (MVP S11.3, Charter R1).
 * @param props - The open profile's service and the pathway's slug.
 * @returns The gap, grouped, or why it couldn't be shown.
 */
export function GapPage({
  service,
  slug,
}: {
  readonly service: CoreService;
  readonly slug: string;
}): ReactElement | null {
  const { t } = useTranslation();
  const { services, changed } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  // The gap, and when it was shown, so "Updated just now" is worked out once rather than on every render.
  const [shown, setShown] = useState<{ view: GapView; at: number } | undefined>(undefined);
  const explore = useMutation({
    mutationFn: async (): Promise<GapFailure | undefined> => {
      const gap = await service.exploreGap(slug);
      changed();
      if (gap.ok) {
        setShown({ view: gap.value, at: Date.now() });
        return undefined;
      }
      if (gap.error.kind === "unknown-pathway") return "unknown-pathway";
      return gap.error.kind === "conflict" ? "changed-outside" : "failed";
    },
  });
  const { mutate } = explore;
  useEffect(() => {
    mutate();
  }, [mutate]);

  if (explore.data === "unknown-pathway") {
    return (
      <>
        <PageTitle title={t("pathways.title")} lead={t("pathways.missing")} />
        <Link to="/pathways" className="text-channel underline">
          {t("pathways.back")}
        </Link>
      </>
    );
  }
  if (shown === undefined || content.data === undefined) {
    return explore.data === undefined ? null : <FailureNotice failure={explore.data} />;
  }
  const { view } = shown;
  const problem = service.gapProblem(slug);
  const pathway = pathwayDetail(content.data, slug);

  return (
    <>
      <PageTitle
        title={t("gap.title", { pathway: view.pathway.title })}
        lead={t("gap.lead")}
        crumbs={[
          <Link key="pathways" to="/pathways">
            {t("pathways.title")}
          </Link>,
          <Link key="pathway" to="/pathways/$slug" params={{ slug }}>
            {view.pathway.title}
          </Link>,
        ]}
        crumbsLabel={t("app.crumbs")}
        actions={
          <>
            <p role="status" className="inline-flex items-center gap-1.5 self-center text-meta text-ink-2">
              <Icon of={History} size="sm" />
              {shown.at - Date.parse(view.updated) < 60_000
                ? t("gap.updatedNow")
                : t("gap.updated", { date: dayName(t, view.updated) })}
            </p>
            <Button
              disabled={explore.isPending}
              onClick={() => {
                explore.mutate();
              }}
            >
              <Icon of={RefreshCw} />
              {t("gap.refresh")}
            </Button>
          </>
        }
      />
      <div className="grid gap-(--gap)">
        {explore.data === undefined ? null : <FailureNotice failure={explore.data} />}
        {problem === undefined ? null : <Notice tone="attention" title={t("gap.problem")} />}
        {pathway === undefined ? null : (
          <>
            <PathwayProvenance pathway={pathway} />
            {/* What the gap means and what the pathway is come first, side by side (the design system's gap view). */}
            <div className="grid gap-(--gap) lg:grid-cols-2">
              <GapMeaning
                service={service}
                pathway={pathway}
                onGap={(gap) => {
                  explore.reset();
                  setShown({ view: gap, at: Date.now() });
                }}
              />
              <AboutPathway pathway={pathway} />
            </div>
          </>
        )}
        {GROUPS.map((group) => (
          <Group
            key={group}
            group={group}
            items={view.requirements.filter((item) => item.group === group)}
            headed={group === GROUPS.find((first) => view.requirements.some((item) => item.group === first))}
            service={service}
            content={content.data}
          />
        ))}
        <p className="inline-flex items-center gap-1.5 text-meta text-ink-2">
          <Icon of={FileText} size="sm" />
          {t("gap.stored", { file: view.location })}
        </p>
      </div>
    </>
  );
}

function FailureNotice({ failure }: { readonly failure: GapFailure }): ReactElement | null {
  const { t } = useTranslation();
  switch (failure) {
    case "unknown-pathway":
      return null;
    case "changed-outside":
      return <ChangedOutsideNotice title={t("gap.changedOutside")} />;
    case "failed":
      return <Notice tone="problem" title={t("gap.failed")} />;
  }
}

// What the pathway is, in the pack's own words. Its sources stay on the pathway's page, beside each requirement:
// their titles quote survey percentages, which beside a gap could read as a score (Charter R1, MVP S11.3).
function AboutPathway({ pathway }: { readonly pathway: PathwayDetail }): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="rounded-lg border border-line bg-surface p-(--pad)">
      <div className="mb-(--space-3) flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={titleId} className="text-section font-bold tracking-[-0.01em]">
          {t("gap.about.title")}
        </h2>
        <span className="text-meta text-ink-2">{t("gap.about.from")}</span>
      </div>
      {pathway.about === "" ? <p>{pathway.summary}</p> : <Markdown text={pathway.about} />}
    </section>
  );
}

// One group of requirements in a sheet. The column names show once, on the first group; every group keeps them for
// screen readers, and each group's columns line up with the others.
function Group({
  group,
  items,
  headed,
  service,
  content,
}: {
  readonly group: GapGroup;
  readonly items: readonly GapItem[];
  readonly headed: boolean;
  readonly service: CoreService;
  readonly content: ContentPack;
}): ReactElement | null {
  const { t } = useTranslation();
  const tagId = useId();
  const titleId = useId();
  if (items.length === 0) return null;
  const { icon, tone } = GROUP_LOOK[group];
  return (
    <section
      aria-labelledby={`${tagId} ${titleId}`}
      className="rounded-lg border border-line bg-surface px-(--pad) pt-(--pad) pb-(--space-2)"
    >
      <div className="mb-(--space-2) flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span id={tagId} className="self-center">
          <Tag tone={tone} icon={icon}>
            {t(`gap.tags.${group}`)}
          </Tag>
        </span>
        <h2 id={titleId} className="text-section font-bold tracking-[-0.01em]">
          {t(`gap.groups.${group}`)}
        </h2>
        <p className="text-ink-2">{t(`gap.groupLeads.${group}`)}</p>
      </div>
      <div className="overflow-x-auto max-sm:overflow-visible">
        <table className={`${TABLE.table} max-sm:block sm:min-w-[720px] sm:table-fixed`}>
          <colgroup className="max-sm:hidden">
            <col className="w-[26%]" />
            <col className="w-[16%]" />
            <col className="w-[40%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead className={headed ? "max-sm:sr-only" : "sr-only"}>
            <tr>
              <th scope="col" className={TABLE.head}>
                {t("gap.columns.requirement")}
              </th>
              <th scope="col" className={TABLE.head}>
                {t("gap.columns.asked")}
              </th>
              <th scope="col" className={TABLE.head}>
                {t("gap.columns.yours")}
              </th>
              <th scope="col" className={`${TABLE.head} text-end`}>
                <span className="sr-only">{t("gap.columns.next")}</span>
              </th>
            </tr>
          </thead>
          {(["core", "helpful"] as const).map((importance) => {
            const rows = items.filter((item) => item.importance === importance);
            if (rows.length === 0) return null;
            return (
              <tbody key={importance} className="max-sm:block">
                <tr className="max-sm:block">
                  <th
                    colSpan={4}
                    scope="rowgroup"
                    className="pt-4 pb-1 text-start text-meta font-semibold text-ink-2 max-sm:block"
                  >
                    <Icon
                      of={IMPORTANCE[importance]}
                      size="xs"
                      className="me-1.5 inline-block align-[-1px]"
                    />
                    {t(`pathways.importance.${importance}`)}
                  </th>
                </tr>
                {rows.map((item) => (
                  <Requirement key={item.skill} item={item} service={service} content={content} />
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
    </section>
  );
}

// Each group's tag: what to act on first in neutral greys, a tested level in the channel.
const GROUP_LOOK: Record<GapGroup, { readonly icon: LucideIcon; readonly tone: TagTone }> = {
  below: { icon: Footprints, tone: "below" },
  unknown: { icon: CloudFog, tone: "unknown" },
  claimed: { icon: MessageSquareQuote, tone: "claimed" },
  supported: { icon: Anchor, tone: "supported" },
};

// The glyph for a requirement's weight: a diamond for core, a circle for helpful.
const IMPORTANCE = { core: Diamond, helpful: Circle } as const;

// On a phone each requirement stacks into one block, each cell labelled; fields move, they are never dropped.
const STACK_ROW =
  "max-sm:grid max-sm:grid-cols-2 max-sm:gap-x-3 max-sm:gap-y-1.5 max-sm:border-b max-sm:border-line-soft max-sm:py-3";
const STACK_CELL =
  "max-sm:h-auto max-sm:border-0 max-sm:p-0 max-sm:grid max-sm:content-start max-sm:gap-0.5 max-sm:before:text-meta max-sm:before:text-ink-3 max-sm:before:content-[attr(data-label)]";

function Requirement({
  item,
  service,
  content,
}: {
  readonly item: GapItem;
  readonly service: CoreService;
  readonly content: ContentPack;
}): ReactElement {
  const { t } = useTranslation();
  const list = new Intl.ListFormat(t("app.locale"), { type: "conjunction" });
  const cited = [
    ...new Set(
      item.evidence.map(
        (e) => e.title ?? (service.find(e.id) === undefined ? t("gap.removedEvidence") : e.id),
      ),
    ),
  ];
  const core = item.importance === "core";
  return (
    <tr className={STACK_ROW}>
      <th scope="row" className={`${TABLE.rowHead} max-sm:col-span-2 max-sm:h-auto max-sm:border-0`}>
        <Icon
          of={IMPORTANCE[item.importance]}
          size="xs"
          className="me-1.5 inline-block align-[-1px] text-ink-2"
        />
        <span className="sr-only">
          {t("gap.importanceLabel", { importance: t(`pathways.importance.${item.importance}`) })}{" "}
        </span>
        <Link
          to="/skills/$skill"
          params={{ skill: item.skill }}
          className="text-ink no-underline hover:underline"
        >
          {item.name}
        </Link>
      </th>
      <td data-label={t("gap.columns.asked")} className={`${TABLE.cell} ${STACK_CELL} whitespace-nowrap`}>
        <Level level={item.required} name={levelName(content, item.required)} />
      </td>
      <td data-label={t("gap.columns.yours")} className={`${TABLE.cell} ${STACK_CELL}`}>
        {item.shown === null ? (
          <span className="text-ink-2">{t("gap.noLevel")}</span>
        ) : (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
            <Level
              level={item.shown.level}
              name={levelName(content, item.shown.level)}
              source={item.shown.provenance}
            />
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-2">
              <SourceTag provenance={item.shown.provenance} />
              {item.shown.provenance === "self-reported" ? <span>{t("gap.ownRating")}</span> : null}
            </span>
            {cited.length === 0 ? null : (
              <span className="inline-flex items-center gap-1 text-meta text-ink-2">
                <Icon of={Paperclip} size="sm" />
                {t("gap.cites", { evidence: list.format(cited) })}
              </span>
            )}
          </span>
        )}
      </td>
      <td
        className={`${TABLE.cell} text-end whitespace-nowrap max-sm:col-span-2 max-sm:h-auto max-sm:border-0 max-sm:p-0 max-sm:text-start max-sm:empty:hidden`}
      >
        {item.group === "unknown" || item.group === "below" ? (
          <Link
            to="/skills/record"
            search={{ skill: item.skill }}
            className={buttonClassName(core ? "secondary" : "quiet", "sm")}
          >
            {item.group === "unknown" ? <Icon of={Plus} size="sm" /> : null}
            {item.group === "unknown" ? t("gap.sayWhere") : t("skills.record")}
          </Link>
        ) : null}
      </td>
    </tr>
  );
}
