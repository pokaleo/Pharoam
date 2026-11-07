/**
 * The skills overview: each skill with its one level, where it came from and since when (MVP S9).
 *
 * @packageDocumentation
 */
import type { ContentPack, CoreService, EvidenceRecord, SkillViewItem } from "@pharoam/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Paperclip, Plus, Search, UserRoundPen } from "lucide-react";
import { useId, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../profile/session.tsx";
import { dayName, levelName } from "../skills/labels.ts";
import { Level } from "../skills/level.tsx";
import { SourceTag } from "../skills/source-tag.tsx";
import { ObservationLine, ReviewLine, Timeline, TimelineEntry } from "../skills/timeline.tsx";
import { AiMark } from "../ui/ai-mark.tsx";
import { buttonClassName } from "../ui/button.tsx";
import { Empty } from "../ui/empty.tsx";
import { CONTROL } from "../ui/field.tsx";
import { Icon } from "../ui/icon.tsx";
import { PageTitle } from "../ui/page-title.tsx";
import { TABLE } from "../ui/table.ts";
import { Tag } from "../ui/tag.tsx";
import { kindName } from "./evidence-list-page.tsx";

// On a phone the table stacks into one block per skill, each cell labelled; fields move, they are never dropped.
const STACK_ROW =
  "max-sm:grid max-sm:grid-cols-2 max-sm:gap-x-3 max-sm:gap-y-1.5 max-sm:border-b max-sm:border-line-soft max-sm:py-3";
const STACK_CELL =
  "max-sm:h-auto max-sm:border-0 max-sm:p-0 max-sm:grid max-sm:content-start max-sm:gap-0.5 max-sm:before:text-meta max-sm:before:text-ink-3 max-sm:before:content-[attr(data-label)]";

/**
 * Lists the person's skills, grouped by domain and narrowed by a search or a domain.
 *
 * @remarks One level per skill, picked by the written order and never blended (MVP S9.1, PRD C4); in v0.1 that is
 * the latest self-reported level. Each shows its source label and since when, and how many evidence records are
 * linked to the skill, which carry no level. No scores or totals; the count names how many skills the view shows.
 * Custom skills are marked as the person's own (MVP S8.2).
 * @param props - The open profile's service.
 * @returns The title, the ways to add, and the sheet with the list tools and the table of skills.
 */
export function SkillsPage({ service }: { readonly service: CoreService }): ReactElement {
  const { t } = useTranslation();
  const { services } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("");
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const vocabulary = content.data?.skills ?? [];
  const all = service.skillView(vocabulary);
  const shown = service.skillView(vocabulary, {
    ...(query.trim() === "" ? {} : { query: query.trim() }),
    ...(domain === "" ? {} : { domain }),
  });
  const collator = new Intl.Collator(t("app.locale"));
  const domains = [...new Set(all.flatMap((item) => (item.domain === undefined ? [] : [item.domain])))].sort(
    collator.compare,
  );
  const evidence = service
    .records()
    .flatMap((loaded) => (loaded.record.schema === "evidence/1" ? [loaded.record] : []));
  const linked = (skill: string): number =>
    evidence.filter((record) => record.skills.some((slug) => slug === skill)).length;
  // Domains in name order, skills without one last; within each, the view's own order.
  const byDomain = new Map<string, SkillViewItem[]>();
  for (const item of shown)
    byDomain.set(item.domain ?? "", [...(byDomain.get(item.domain ?? "") ?? []), item]);
  const groups = [...byDomain].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : collator.compare(a, b)));
  // The skill shown beside the list: the one chosen, while the view still shows it, or else the first one listed.
  const selected = shown.find((item) => item.skill === picked) ?? groups[0]?.[1][0];

  return (
    <>
      <PageTitle
        title={t("skills.title")}
        lead={t("skills.lead", { count: all.length })}
        actions={
          <>
            {service.judgeableSkills().length === 0 ? null : (
              <Link to="/scan" search={{ kind: "levels" }} className={buttonClassName("secondary")}>
                <AiMark />
                {t("skills.askLevels")}
              </Link>
            )}
            <Link to="/skills/custom" className={buttonClassName("secondary")}>
              <Icon of={Plus} />
              {t("skills.addCustom")}
            </Link>
            <Link to="/skills/record" className={buttonClassName("primary")}>
              {t("skills.record")}
            </Link>
          </>
        }
      />
      {all.length === 0 ? (
        <Empty text={t("skills.empty")} />
      ) : (
        <div className="grid items-start gap-(--gap) min-[1360px]:grid-cols-[minmax(0,1fr)_360px] min-[1440px]:grid-cols-[minmax(0,1fr)_400px]">
          <section
            aria-labelledby="skills-table-title"
            className="min-w-0 rounded-lg border border-line bg-surface"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-(--space-3) px-(--pad) pt-(--pad)">
              <h2 id="skills-table-title" className="text-section font-bold tracking-[-0.01em]">
                {t("skills.table")}
              </h2>
              <span className="text-meta text-ink-3">{t("skills.whichLevel")}</span>
            </div>
            <div
              role="search"
              aria-label={t("skills.find")}
              className="flex flex-wrap items-center gap-x-(--space-3) gap-y-(--space-2) px-(--pad) pt-(--space-3)"
            >
              <label className="relative min-w-40 flex-[0_1_220px]">
                <Icon
                  of={Search}
                  className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-ink-3"
                />
                <input
                  type="search"
                  aria-label={t("skills.search")}
                  placeholder={t("skills.search")}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.currentTarget.value);
                  }}
                  className={`${CONTROL} ps-8`}
                />
              </label>
              <label className="inline-flex items-center gap-2 text-meta text-ink-2">
                {t("skills.domain")}
                <select
                  value={domain}
                  onChange={(event) => {
                    setDomain(event.currentTarget.value);
                  }}
                  className={`${CONTROL} select-chevron w-auto text-body`}
                >
                  <option value="">{t("skills.allDomains")}</option>
                  {domains.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <span aria-live="polite" className="ms-auto text-meta text-ink-2 tabular-nums">
                {t("skills.count", { count: shown.length })}
              </span>
            </div>
            <div className="overflow-x-auto px-(--pad) pt-1 pb-(--space-3) max-sm:overflow-visible">
              <table className={`${TABLE.table} sm:min-w-[560px]`}>
                <caption className="sr-only">{t("skills.table")}</caption>
                <thead className="max-sm:sr-only">
                  <tr>
                    <th scope="col" className={TABLE.head}>
                      {t("skills.columns.skill")}
                    </th>
                    <th scope="col" className={TABLE.head}>
                      {t("skills.columns.level")}
                    </th>
                    <th scope="col" className={TABLE.head}>
                      {t("skills.columns.source")}
                    </th>
                    <th scope="col" className={`${TABLE.head} text-end`}>
                      <Icon of={Paperclip} size="sm" className="me-1 inline-block align-[-3px]" />
                      {t("skills.columns.evidence")}
                      <span className="sr-only">{t("skills.columns.evidenceHint")}</span>
                    </th>
                  </tr>
                </thead>
                {groups.map(([name, items]) => (
                  <tbody key={name}>
                    <tr data-group="" className="max-sm:block">
                      <td colSpan={4} className={`${TABLE.group} max-sm:block`}>
                        {name === "" ? t("skills.noDomain") : name}
                      </td>
                    </tr>
                    {items.map((item) => (
                      <SkillRow
                        key={item.skill}
                        item={item}
                        linked={linked(item.skill)}
                        levelOf={(level) => levelName(content.data, level)}
                        selected={item.skill === selected?.skill}
                        onSelect={() => {
                          setPicked(item.skill);
                        }}
                      />
                    ))}
                  </tbody>
                ))}
              </table>
              {shown.length === 0 ? <p className="pt-(--space-4) text-ink-2">{t("skills.noMatch")}</p> : null}
            </div>
          </section>
          {selected === undefined || content.data === undefined ? null : (
            <SkillDetail
              key={selected.skill}
              item={selected}
              service={service}
              content={content.data}
              evidence={evidence.filter((record) => record.skills.some((slug) => slug === selected.skill))}
            />
          )}
        </div>
      )}
    </>
  );
}

// One skill's row. Choosing it, by pointer anywhere on the row or by moving focus into it, shows it beside the list;
// its name still opens the skill's page.
function SkillRow({
  item,
  linked,
  levelOf,
  selected,
  onSelect,
}: {
  readonly item: SkillViewItem;
  readonly linked: number;
  readonly levelOf: (level: number) => string;
  readonly selected: boolean;
  readonly onSelect: () => void;
}): ReactElement {
  const { t } = useTranslation();
  return (
    <tr
      data-selected={selected ? "" : undefined}
      onClick={onSelect}
      onFocus={onSelect}
      className={`cursor-pointer hover:[&>*]:bg-[color-mix(in_oklab,var(--panel)_60%,transparent)] data-selected:[&>*]:bg-active max-sm:data-selected:-mx-2 max-sm:data-selected:rounded-md max-sm:data-selected:bg-active max-sm:data-selected:px-2 ${STACK_ROW}`}
    >
      <th scope="row" className={`${TABLE.rowHead} max-sm:col-span-2 max-sm:h-auto max-sm:border-0`}>
        <span className="flex flex-wrap items-center gap-2">
          <Link
            to="/skills/$skill"
            params={{ skill: item.skill }}
            className="text-ink no-underline hover:underline"
          >
            {item.name}
          </Link>
          {item.custom ? (
            <Tag tone="custom" icon={UserRoundPen}>
              {t("skills.own")}
            </Tag>
          ) : null}
        </span>
      </th>
      <td data-label={t("skills.columns.level")} className={`${TABLE.cell} ${STACK_CELL}`}>
        {item.shown === undefined ? (
          <span className="text-ink-3">{t("skills.noLevel")}</span>
        ) : (
          <Level level={item.shown.level} name={levelOf(item.shown.level)} source={item.shown.provenance} />
        )}
      </td>
      <td data-label={t("skills.columns.source")} className={`${TABLE.cell} ${STACK_CELL}`}>
        {item.shown === undefined ? null : (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-2">
            <SourceTag provenance={item.shown.provenance} />
            <span>{t("skills.since", { date: dayName(t, item.shown.since) })}</span>
          </span>
        )}
      </td>
      <td
        data-label={t("skills.columns.evidence")}
        className={`${TABLE.cell} ${STACK_CELL} text-end text-ink-2 tabular-nums max-sm:text-start`}
      >
        {linked === 0 ? (
          <span className="text-ink-3">
            <span aria-hidden="true">—</span>
            <span className="sr-only">{t("skills.noEvidence")}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-[5px]">
            <Icon of={Paperclip} size="sm" />
            {linked}
            <span className="sr-only">{` ${t("skills.evidenceCount", { count: linked })}`}</span>
          </span>
        )}
      </td>
    </tr>
  );
}

// How many of the newest history entries the panel shows; the skill's page has them all.
const LATEST = 3;

// The chosen skill beside the list: its one level and where it came from, the evidence linked to it, and its latest
// history, with the way to the rest (the design system's skills overview).
function SkillDetail({
  item,
  service,
  content,
  evidence,
}: {
  readonly item: SkillViewItem;
  readonly service: CoreService;
  readonly content: ContentPack;
  readonly evidence: readonly EvidenceRecord[];
}): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  const linkedId = useId();
  const historyId = useId();
  const history = service.skillHistory(item.skill);
  return (
    <section
      aria-labelledby={titleId}
      className="grid gap-(--space-4) rounded-lg bg-panel p-(--pad) min-[1360px]:sticky min-[1360px]:top-4"
    >
      <div>
        <h2 id={titleId} className="text-section font-bold tracking-[-0.01em]">
          {item.name}
        </h2>
        <p className="mt-0.5 text-meta text-ink-2">
          {item.domain === undefined ? null : `${item.domain} · `}
          <code className="font-mono text-[12px] text-ink">{item.location}</code>
        </p>
      </div>
      {item.shown === undefined ? (
        <p className="text-ink-2">{t("skills.skillPage.noCount")}</p>
      ) : (
        <div className="grid justify-items-start gap-1.5">
          <p className="flex flex-wrap items-baseline gap-x-(--space-3)">
            <Level
              data-shown-level
              level={item.shown.level}
              name={levelName(content, item.shown.level)}
              source={item.shown.provenance}
              size="lg"
            />
            <span className="text-ink-3">
              {t("skills.skillPage.levelNumber", { level: item.shown.level })}
            </span>
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-2">
            <SourceTag provenance={item.shown.provenance} />
            <span>{t("skills.since", { date: dayName(t, item.shown.since) })}</span>
          </p>
        </div>
      )}
      <div>
        <div className="mb-1 flex items-baseline justify-between gap-(--space-3)">
          <h3 id={linkedId} className="font-semibold">
            {t("skills.detail.linked")}
          </h3>
          {evidence.length === 0 ? null : (
            <span className="text-meta text-ink-2">
              {t("skills.detail.linkedCount", { count: evidence.length })}
            </span>
          )}
        </div>
        {evidence.length === 0 ? (
          <p className="text-meta text-ink-2">{t("skills.detail.noLinked")}</p>
        ) : (
          <ul aria-labelledby={linkedId}>
            {evidence.map((record) => (
              <li
                key={record.id}
                className="flex min-h-9 items-baseline justify-between gap-(--space-3) border-b border-line-soft py-1.5 last:border-b-0"
              >
                <Link to="/evidence/$id" params={{ id: record.id }} className="min-w-0">
                  {record.title}
                </Link>
                <span className="text-meta whitespace-nowrap text-ink-2">{kindName(t, record.kind)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {history.length === 0 ? null : (
        <div>
          <div className="mb-2.5 flex items-baseline justify-between gap-(--space-3)">
            <h3 id={historyId} className="font-semibold">
              {t("skills.skillPage.history")}
            </h3>
            <span className="text-meta text-ink-3">{t("skills.skillPage.newestFirst")}</span>
          </div>
          <Timeline label={t("skills.skillPage.history")}>
            {history.slice(0, LATEST).map((entry) =>
              entry.kind === "review" ? (
                <TimelineEntry
                  key={entry.entry.id}
                  dot="retracted"
                  when={dayName(t, entry.entry.reviewed_at)}
                >
                  <ReviewLine item={entry} history={history} />
                </TimelineEntry>
              ) : (
                <TimelineEntry
                  key={entry.entry.id}
                  dot={entry.status === "counts" ? entry.entry.provenance : "retracted"}
                  when={dayName(t, entry.entry.observed_at)}
                >
                  <ObservationLine item={entry} content={content} />
                </TimelineEntry>
              ),
            )}
          </Timeline>
        </div>
      )}
      <Link to="/skills/$skill" params={{ skill: item.skill }} className="justify-self-start font-semibold">
        {history.length === 0
          ? t("skills.detail.open")
          : t("skills.detail.allEntries", { count: history.length })}
      </Link>
    </section>
  );
}
