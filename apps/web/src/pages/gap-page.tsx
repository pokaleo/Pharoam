/**
 * The gap to a pathway (MVP S11).
 *
 * @packageDocumentation
 */
import type { ContentPack, CoreService, GapGroup, GapItem, GapView } from "@pharoam/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useId, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../profile/session.tsx";
import { dayName, levelName, sourceName } from "../skills/labels.ts";
import { Button } from "../ui/button.tsx";
import { ChangedOutsideNotice } from "../ui/changed-outside.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";

const GROUPS: readonly GapGroup[] = ["supported", "claimed", "below", "unknown"];

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

  return (
    <>
      <PageTitle title={t("gap.title", { pathway: view.pathway.title })} lead={t("gap.lead")} />
      <div className="grid max-w-[72ch] gap-(--space-5)">
        <div className="flex flex-wrap items-center gap-(--space-3)">
          <p role="status" className="text-ink-2">
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
            {t("gap.refresh")}
          </Button>
        </div>
        {explore.data === undefined ? null : <FailureNotice failure={explore.data} />}
        {problem === undefined ? null : <Notice tone="attention" title={t("gap.problem")} />}
        {GROUPS.map((group) => (
          <Group
            key={group}
            group={group}
            items={view.requirements.filter((item) => item.group === group)}
            service={service}
            content={content.data}
          />
        ))}
        <p className="text-meta text-ink-2">{t("gap.stored", { file: view.location })}</p>
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

function Group({
  group,
  items,
  service,
  content,
}: {
  readonly group: GapGroup;
  readonly items: readonly GapItem[];
  readonly service: CoreService;
  readonly content: ContentPack;
}): ReactElement | null {
  const { t } = useTranslation();
  const titleId = useId();
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={titleId} className="grid gap-(--space-2)">
      <h2 id={titleId} className="text-section font-bold">
        {t(`gap.groups.${group}`)}
      </h2>
      <p className="text-ink-2">{t(`gap.groupLeads.${group}`)}</p>
      <ul className="grid divide-y divide-line-soft rounded-lg bg-surface">
        {items.map((item) => (
          <Requirement key={item.skill} item={item} service={service} content={content} />
        ))}
      </ul>
    </section>
  );
}

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
  const nameId = useId();
  const list = new Intl.ListFormat(t("app.locale"), { type: "conjunction" });
  const cited = [
    ...new Set(
      item.evidence.map(
        (e) => e.title ?? (service.find(e.id) === undefined ? t("gap.removedEvidence") : e.id),
      ),
    ),
  ];
  return (
    <li aria-labelledby={nameId} className="grid gap-1 px-(--pad) py-(--space-3)">
      <Link
        id={nameId}
        to="/skills/$skill"
        params={{ skill: item.skill }}
        className="font-semibold text-ink underline-offset-[0.18em] hover:underline"
      >
        {item.name}
      </Link>
      <p className="text-meta text-ink-2">
        {t("gap.asks", {
          level: levelName(content, item.required),
          number: item.required,
          importance: t(`pathways.importance.${item.importance}`),
        })}
      </p>
      {item.shown === null ? null : (
        <p className="text-meta">
          {t("gap.shows", {
            level: levelName(content, item.shown.level),
            number: item.shown.level,
            source:
              item.shown.provenance === "self-reported"
                ? t("gap.ownRating")
                : sourceName(t, item.shown.provenance),
          })}
        </p>
      )}
      {cited.length === 0 ? null : (
        <p className="text-meta text-ink-2">{t("gap.cites", { evidence: list.format(cited) })}</p>
      )}
    </li>
  );
}
