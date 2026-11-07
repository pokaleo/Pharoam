/**
 * Review: the AI suggestions waiting for the person's decision, and the scans they came from (MVP S16.6, S16.7).
 *
 * @packageDocumentation
 */
import type { CoreService, ContentPack, ReviewItem, SessionRecord } from "@pharoam/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { setAsideReason } from "../ai/problems.ts";
import { useSession } from "../profile/session.tsx";
import { skillChoices, skillName, type SkillChoice } from "../profile/skills.ts";
import { levelName } from "../skills/labels.ts";
import { AiMark } from "../ui/ai-mark.tsx";
import { Button, buttonClassName } from "../ui/button.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";

// What the last action did, as the person is told.
type Outcome =
  | {
      readonly kind: "decided";
      readonly accepted: number;
      readonly discarded: number;
      readonly refused: number;
      readonly failed: boolean;
    }
  | { readonly kind: "failed" }
  | { readonly kind: "adjusted" }
  | { readonly kind: "deleted" }
  | { readonly kind: "delete-failed" };

/**
 * The Review screen: every pending suggestion, from every scan, to accept, skip, discard or adjust (MVP S16.6, S16.7).
 *
 * @remarks Accepting writes the link or the `ai-judged` level (S16.8, S16.9); discarding writes only the decision;
 * skipping leaves it pending, where it never counts (Charter R5). A suggestion whose evidence changed since the scan
 * read it can only be discarded or scanned again (S16.10). Every button waits while a decision is being written, so
 * one decision is never applied twice. Past scans are listed with what they found, and can be deleted (S16.11,
 * S16.14). There are no confidence scores anywhere (hard rule 9).
 * @param props - The open profile's service.
 * @returns The pending suggestions, any skipped for now, and the past scans.
 */
export function ReviewPage({ service }: { readonly service: CoreService }): ReactElement {
  const { t } = useTranslation();
  const { services, changed } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  const skills = content.data === undefined ? [] : skillChoices(content.data, service.records());
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>();
  const heading = useRef<HTMLHeadingElement>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const items = service.reviewItems();
  const pending = items.filter((item) => !skipped.has(item.suggestion.id));
  const set = items.filter((item) => skipped.has(item.suggestion.id));
  const chosen = pending.filter((item) => selected.has(item.suggestion.id));
  const title = (item: ReviewItem): string => itemTitle(t, service, skills, content.data, item);

  // Runs one action at a time: every button waits, and the outcome is said when it ends, whatever happened.
  const act = async (action: () => Promise<Outcome>): Promise<void> => {
    setBusy(true);
    try {
      setOutcome(await action());
    } catch {
      setOutcome({ kind: "failed" });
    } finally {
      changed();
      setBusy(false);
      heading.current?.focus();
    }
  };

  const decide = (which: readonly ReviewItem[], decision: "accept" | "discard"): Promise<void> =>
    act(async () => {
      const report = await service.decideSuggestions(which, decision);
      const done = new Set(report.decided);
      setSelected((current) => new Set([...current].filter((id) => !done.has(id))));
      return {
        kind: "decided",
        accepted: decision === "accept" ? report.decided.length : 0,
        discarded: decision === "discard" ? report.decided.length : 0,
        refused: report.refused.filter((one) => one.reason === "stale").length,
        failed: report.failed !== undefined,
      };
    });

  const adjust = (item: ReviewItem, level: number): Promise<void> =>
    act(async () => {
      const adjusted = await service.adjustSuggestion(item, level);
      return adjusted.ok ? { kind: "adjusted" } : { kind: "failed" };
    });

  return (
    <>
      <PageTitle
        title={t("review.title")}
        lead={t("review.lead")}
        titleRef={heading}
        actions={
          <Link to="/scan" search={{ kind: "links" }} className={buttonClassName("secondary")}>
            <AiMark />
            {t("review.scan")}
          </Link>
        }
      />
      <div className="grid max-w-[880px] gap-(--space-4)">
        <OutcomeLine outcome={outcome} />
        {pending.length === 0 ? (
          <p className="text-ink-2">{t("review.none")}</p>
        ) : (
          <>
            <Notice tone="info" title={t("review.mistakes")} />
            {chosen.length === 0 ? null : (
              <div className="flex flex-wrap gap-(--space-2)">
                <Button
                  variant="primary"
                  disabled={busy || chosen.some((item) => item.stale)}
                  onClick={() => void decide(chosen, "accept")}
                >
                  {t("review.acceptSelected", { count: chosen.length })}
                </Button>
                <Button disabled={busy} onClick={() => void decide(chosen, "discard")}>
                  {t("review.discardSelected", { count: chosen.length })}
                </Button>
              </div>
            )}
            {pending.map((item) => (
              <SuggestionCard
                key={item.suggestion.id}
                service={service}
                content={content.data}
                item={item}
                title={title(item)}
                busy={busy}
                selected={selected.has(item.suggestion.id)}
                onSelect={(on) => {
                  const next = new Set(selected);
                  if (on) next.add(item.suggestion.id);
                  else next.delete(item.suggestion.id);
                  setSelected(next);
                }}
                onDecide={(decision) => void decide([item], decision)}
                onSkip={() => {
                  setSkipped(new Set([...skipped, item.suggestion.id]));
                }}
                onAdjust={(level) => void adjust(item, level)}
              />
            ))}
          </>
        )}
        {set.length === 0 ? null : (
          <Skipped
            items={set.map((item) => ({ id: item.suggestion.id, title: title(item) }))}
            onShow={() => {
              setSkipped(new Set());
            }}
          />
        )}
        <PastScans service={service} skills={skills} busy={busy} act={act} />
      </div>
    </>
  );
}

// The suggestion's name, as the person reads it: "SQL for Payments API", or "Python: level 3, Proficient".
function itemTitle(
  t: ReturnType<typeof useTranslation>["t"],
  service: CoreService,
  skills: readonly SkillChoice[],
  content: ContentPack | undefined,
  item: ReviewItem,
): string {
  const { suggestion } = item;
  const skill = skillName(skills, suggestion.skill);
  if (suggestion.kind === "skill-level")
    return t("review.levelTitle", {
      skill,
      level: suggestion.level,
      name: levelName(content, suggestion.level),
    });
  return t("review.linkTitle", { skill, evidence: evidenceTitle(service, suggestion.evidence) });
}

function evidenceTitle(service: CoreService, id: string): string {
  const found = service.find(id);
  return found?.record.schema === "evidence/1" ? found.record.title : id;
}

function OutcomeLine({ outcome }: { readonly outcome: Outcome | undefined }): ReactElement {
  const { t } = useTranslation();
  const problem =
    outcome?.kind === "failed" || (outcome?.kind === "decided" && outcome.failed)
      ? t("review.failed")
      : outcome?.kind === "delete-failed"
        ? t("review.deleteFailed")
        : undefined;
  const parts =
    outcome === undefined || outcome.kind === "failed" || outcome.kind === "delete-failed"
      ? []
      : outcome.kind === "decided"
        ? [
            ...(outcome.accepted > 0 ? [t("review.accepted", { count: outcome.accepted })] : []),
            ...(outcome.discarded > 0 ? [t("review.discarded", { count: outcome.discarded })] : []),
            ...(outcome.refused > 0 ? [t("review.refused", { count: outcome.refused })] : []),
          ]
        : [t(outcome.kind === "adjusted" ? "review.adjusted" : "review.deleted")];
  return (
    <>
      <p role="status" className="empty:sr-only">
        {parts.join(" ")}
      </p>
      {problem === undefined ? null : <Notice tone="problem" title={problem} />}
    </>
  );
}

function SuggestionCard({
  service,
  content,
  item,
  title,
  busy,
  selected,
  onSelect,
  onDecide,
  onSkip,
  onAdjust,
}: {
  readonly service: CoreService;
  readonly content: ContentPack | undefined;
  readonly item: ReviewItem;
  readonly title: string;
  readonly busy: boolean;
  readonly selected: boolean;
  readonly onSelect: (on: boolean) => void;
  readonly onDecide: (decision: "accept" | "discard") => void;
  readonly onSkip: () => void;
  readonly onAdjust: (level: number) => void;
}): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  const { suggestion, stale } = item;
  const [adjusting, setAdjusting] = useState(false);
  const [level, setLevel] = useState<number>();

  return (
    <article
      aria-labelledby={titleId}
      className="grid gap-(--space-3) rounded-lg border border-line bg-surface p-(--pad)"
    >
      <div className="flex flex-wrap items-start justify-between gap-(--space-2)">
        <div className="grid gap-1">
          <h2 id={titleId} className="text-section font-bold">
            {title}
          </h2>
          <p className="flex flex-wrap items-center gap-(--space-1) text-meta text-ink-2">
            <AiMark />
            <span className="font-semibold">{t("review.label")}</span>
            <span>{t("review.by", { model: suggestion.ai.model })}</span>
          </p>
        </div>
        <label className="flex items-center gap-(--space-1) text-meta">
          <input
            type="checkbox"
            aria-describedby={titleId}
            checked={selected}
            disabled={busy}
            onChange={(event) => {
              onSelect(event.currentTarget.checked);
            }}
          />
          {t("review.select")}
        </label>
      </div>
      <p>{suggestion.explanation}</p>
      {suggestion.kind === "skill-level" ? (
        <dl className="grid gap-(--space-1)">
          <dt className="text-meta font-semibold text-ink-2">{t("review.limits")}</dt>
          <dd className="m-0">{suggestion.limits}</dd>
          <dt className="text-meta font-semibold text-ink-2">{t("review.restsOn")}</dt>
          <dd className="m-0">
            <ul className="flex flex-wrap gap-x-(--space-3)">
              {suggestion.evidence.map((id) => (
                <li key={id}>
                  <Link to="/evidence/$id" params={{ id }} className="text-channel underline">
                    {evidenceTitle(service, id)}
                  </Link>
                </li>
              ))}
            </ul>
          </dd>
        </dl>
      ) : null}
      {stale ? (
        <Notice tone="attention" title={t("review.stale")}>
          <Link
            to="/scan"
            search={
              suggestion.kind === "skill-link"
                ? { kind: "links", only: suggestion.evidence }
                : { kind: "levels", only: suggestion.skill }
            }
            className="text-channel underline"
          >
            {t("review.scanAgain")}
          </Link>
        </Notice>
      ) : null}
      {adjusting && suggestion.kind === "skill-level" ? (
        <fieldset className="grid gap-(--space-2)">
          <legend className="font-semibold">{t("review.adjustLegend")}</legend>
          {([0, 1, 2, 3, 4] as const).map((n) => (
            <label key={n} className="flex items-center gap-(--space-2)">
              <input
                type="radio"
                name={`${titleId}-level`}
                checked={level === n}
                onChange={() => {
                  setLevel(n);
                }}
              />
              {`${String(n)} ${levelName(content, n)}`}
            </label>
          ))}
          <div className="flex flex-wrap gap-(--space-2)">
            <Button
              variant="primary"
              disabled={busy || level === undefined}
              onClick={() => {
                if (level !== undefined) onAdjust(level);
              }}
            >
              {t("review.recordMine")}
            </Button>
            <Button
              onClick={() => {
                setAdjusting(false);
              }}
            >
              {t("review.cancel")}
            </Button>
          </div>
        </fieldset>
      ) : (
        <div className="flex flex-wrap gap-(--space-2)">
          <Button
            variant="primary"
            disabled={busy || stale}
            onClick={() => {
              onDecide("accept");
            }}
          >
            {t("review.accept")}
          </Button>
          <Button disabled={busy} onClick={onSkip}>
            {t("review.skip")}
          </Button>
          <Button
            variant="quiet"
            disabled={busy}
            onClick={() => {
              onDecide("discard");
            }}
          >
            {t("review.discard")}
          </Button>
          {suggestion.kind === "skill-level" ? (
            <Button
              variant="quiet"
              disabled={busy}
              onClick={() => {
                setAdjusting(true);
              }}
            >
              {t("review.adjust")}
            </Button>
          ) : null}
        </div>
      )}
    </article>
  );
}

function Skipped({
  items,
  onShow,
}: {
  readonly items: readonly { readonly id: string; readonly title: string }[];
  readonly onShow: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="grid gap-(--space-2) rounded-lg bg-panel p-(--pad)">
      <h2 id={titleId} className="text-section font-bold">
        {t("review.skipped")}
      </h2>
      <p className="text-ink-2">{t("review.skippedNote")}</p>
      <ul className="list-disc ps-(--space-4)">
        {items.map(({ id, title }) => (
          <li key={id}>{title}</li>
        ))}
      </ul>
      <div>
        <Button size="sm" onClick={onShow}>
          {t("review.showSkipped")}
        </Button>
      </div>
    </section>
  );
}

function PastScans({
  service,
  skills,
  busy,
  act,
}: {
  readonly service: CoreService;
  readonly skills: readonly SkillChoice[];
  readonly busy: boolean;
  readonly act: (action: () => Promise<Outcome>) => Promise<void>;
}): ReactElement | null {
  const { t } = useTranslation();
  const titleId = useId();
  const question = useRef<HTMLDivElement>(null);
  const [asking, setAsking] = useState<string>();
  // The question appears in place of its button, so focus moves to it.
  useEffect(() => {
    if (asking !== undefined) question.current?.focus();
  }, [asking]);
  const sessions = service
    .records()
    .flatMap(({ location, record }) => (record.schema === "session/1" ? [{ location, record }] : []))
    .sort((a, b) => Date.parse(b.record.created) - Date.parse(a.record.created));
  if (sessions.length === 0) return null;
  const date = new Intl.DateTimeFormat(t("app.locale"), { dateStyle: "long" });

  const remove = (location: string): Promise<void> =>
    act(async () => {
      const deleted = await service.deleteSession(location);
      setAsking(undefined);
      return { kind: deleted.ok ? "deleted" : "delete-failed" };
    });

  return (
    <section aria-labelledby={titleId} className="grid gap-(--space-3)">
      <h2 id={titleId} className="text-section font-bold">
        {t("review.past")}
      </h2>
      <ul className="grid gap-(--space-2)">
        {sessions.map(({ location, record }) => (
          <li key={location} className="grid gap-1 rounded-lg border border-line bg-surface p-(--pad)">
            <p className="font-semibold">
              {t(record.scan === "skill-links" ? "review.pastLinks" : "review.pastLevels", {
                date: date.format(new Date(record.created)),
              })}
              {" · "}
              {t(`review.pastStatus.${record.status}`)}
            </p>
            <p className="text-meta text-ink-2">
              {t("review.decided", {
                decided: record.suggestions.filter((one) => one.decision !== undefined).length,
                total: record.suggestions.length,
              })}
            </p>
            <SessionNotes service={service} skills={skills} record={record} />
            {asking === location ? (
              <div
                ref={question}
                tabIndex={-1}
                role="group"
                aria-label={t("review.deleteQuestion")}
                className="grid gap-(--space-2) rounded-md border border-problem-edge bg-problem-wash p-(--space-2)"
              >
                <p>{t("review.deleteQuestion")}</p>
                <div className="flex flex-wrap gap-(--space-2)">
                  <Button size="sm" variant="primary" disabled={busy} onClick={() => void remove(location)}>
                    {t("review.deleteConfirm")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setAsking(undefined);
                    }}
                  >
                    {t("review.deleteKeep")}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  size="sm"
                  variant="quiet"
                  disabled={busy}
                  onClick={() => {
                    setAsking(location);
                  }}
                >
                  {t("review.delete")}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// What a scan found that wasn't offered: suggestions that would change nothing, and calls set aside (S16.5, S16.11).
function SessionNotes({
  service,
  skills,
  record,
}: {
  readonly service: CoreService;
  readonly skills: readonly SkillChoice[];
  readonly record: SessionRecord;
}): ReactElement {
  const { t } = useTranslation();
  return (
    <>
      {record.already.map((one) => (
        <p key={`${one.skill}${one.evidence ?? ""}`} className="text-meta text-ink-2">
          {one.kind === "skill-link"
            ? t("review.alreadyLink", {
                skill: skillName(skills, one.skill),
                evidence: evidenceTitle(service, one.evidence ?? ""),
              })
            : t("review.alreadyLevel", { skill: skillName(skills, one.skill), level: one.level ?? "" })}
        </p>
      ))}
      {record.set_aside.map((one) => (
        <p key={`${one.skill ?? ""}${one.evidence ?? ""}`} className="text-meta text-ink-2">
          {t("review.setAside", {
            name:
              one.skill === undefined
                ? evidenceTitle(service, one.evidence ?? "")
                : skillName(skills, one.skill),
            reason: setAsideReason(t, one.reason),
          })}
        </p>
      ))}
    </>
  );
}
