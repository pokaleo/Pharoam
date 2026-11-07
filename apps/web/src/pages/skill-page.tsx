/**
 * One skill: its shown level, and its history with corrections and retractions (MVP S7, S8.2, S9.1).
 *
 * @packageDocumentation
 */
import type { ContentPack, CoreService, HistoryItem, Observation, SkillEntry } from "@pharoam/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Pencil, Undo2, UserRoundPen } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../profile/session.tsx";
import { AiMark } from "../ui/ai-mark.tsx";
import { dayName, levelName } from "../skills/labels.ts";
import { LevelChoice } from "../skills/level-choice.tsx";
import { Level } from "../skills/level.tsx";
import { SourceTag } from "../skills/source-tag.tsx";
import { ObservationLine, ReviewLine, Timeline, TimelineEntry } from "../skills/timeline.tsx";
import { Button, buttonClassName } from "../ui/button.tsx";
import { ChangedOutsideNotice } from "../ui/changed-outside.tsx";
import { TextAreaField } from "../ui/field.tsx";
import { Icon } from "../ui/icon.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";
import { Tag } from "../ui/tag.tsx";

/** What the person is doing to one observation. */
interface Change {
  readonly kind: "correct" | "retract";
  readonly observation: Observation;
}

/**
 * Shows a skill's one level and where it came from, and every entry in its history, newest first.
 *
 * @remarks Each entry is marked when it was corrected, retracted, is behind the shown level, or was edited outside
 * Pharoam (MVP S7.3, S12.3). Correcting and retracting append to the history; nothing in it is ever changed
 * (MVP S7.1, S7.2, hard rule 4). Only the person's own current levels can be corrected; any level that still counts
 * can be retracted; a corrected or retracted one no longer counts, so it has neither.
 * @param props - The open profile's service and the skill's slug.
 * @returns The skill's page, once the content pack has loaded.
 */
export function SkillPage({
  service,
  skill,
}: {
  readonly service: CoreService;
  readonly skill: string;
}): ReactElement | null {
  const { services } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  if (content.data === undefined) return null;
  return <SkillDetail service={service} skill={skill} content={content.data} />;
}

function SkillDetail({
  service,
  skill,
  content,
}: {
  readonly service: CoreService;
  readonly skill: string;
  readonly content: ContentPack;
}): ReactElement {
  const { t } = useTranslation();
  const shownId = useId();
  const [change, setChange] = useState<Change | undefined>(undefined);
  const item = service.skillView(content.skills).find((view) => view.skill === skill);
  const entry = content.skills.find((s) => s.slug === skill);
  const history = service.skillHistory(skill);
  const record =
    item === undefined ? undefined : service.records().find((r) => r.location === item.location)?.record;
  const description =
    entry?.description ?? (record?.schema === "skill-record/1" ? record.description : undefined);

  if (item === undefined && entry === undefined) {
    return (
      <>
        <PageTitle title={t("skills.title")} lead={t("skills.skillPage.missing")} />
        <Link to="/skills">{t("skills.skillPage.back")}</Link>
      </>
    );
  }
  const name = item?.name ?? entry?.name ?? skill;
  const domain = item?.domain ?? entry?.domain;
  const judgeable = service.judgeableSkills().includes(skill);
  const outOfDate = judgeable && service.levelOutOfDate(skill);

  return (
    <>
      <PageTitle
        title={name}
        lead={description ?? domain ?? ""}
        crumbs={[
          <Link key="skills" to="/skills">
            {t("skills.title")}
          </Link>,
        ]}
        crumbsLabel={t("app.crumbs")}
        actions={
          <>
            {judgeable ? (
              <Link
                to="/scan"
                search={{ kind: "levels", only: skill }}
                className={buttonClassName("secondary")}
              >
                <AiMark />
                {t(outOfDate ? "skills.skillPage.askAgain" : "skills.skillPage.askLevel")}
              </Link>
            ) : null}
            <Link to="/skills/record" search={{ skill }} className={buttonClassName("primary")}>
              {t("skills.record")}
            </Link>
          </>
        }
      />
      {outOfDate ? <Notice tone="info" title={t("skills.skillPage.outOfDate")} /> : null}
      <div className="grid items-start gap-(--gap) lg:grid-cols-[minmax(0,1fr)_360px]">
        <section
          aria-labelledby={shownId}
          className="grid gap-(--space-3) rounded-lg bg-panel p-(--pad) lg:sticky lg:top-4 lg:order-2"
        >
          <div className="grid gap-1">
            <h2 id={shownId} className="text-meta font-semibold text-ink-2">
              {t("skills.skillPage.shownTitle")}
            </h2>
            {item?.custom === true ? (
              <p>
                <Tag tone="custom" icon={UserRoundPen}>
                  {t("skills.own")}
                </Tag>
              </p>
            ) : null}
          </div>
          {item?.shown === undefined ? (
            <p className="text-ink-2">
              {item === undefined ? t("skills.skillPage.noRecord") : t("skills.skillPage.noCount")}
            </p>
          ) : (
            <>
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
            </>
          )}
          {item === undefined ? null : (
            <p className="text-meta text-ink-2">
              {domain === undefined ? null : `${domain} · `}
              <code className="font-mono text-[12px] text-ink">{item.location}</code>
            </p>
          )}
        </section>
        <div className="grid min-w-0 gap-(--gap)">
          {change === undefined ? null : (
            <ChangePanel
              key={`${change.kind}-${change.observation.id}`}
              service={service}
              content={content}
              entry={entry}
              change={change}
              onDone={() => {
                setChange(undefined);
              }}
            />
          )}
          {history.length === 0 ? null : (
            <History service={service} content={content} history={history} onChange={setChange} />
          )}
        </div>
      </div>
    </>
  );
}

function History({
  service,
  content,
  history,
  onChange,
}: {
  readonly service: CoreService;
  readonly content: ContentPack;
  readonly history: readonly HistoryItem[];
  readonly onChange: (change: Change) => void;
}): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  const list = new Intl.ListFormat(t("app.locale"), { type: "conjunction" });
  const describe = (observation: Observation): string =>
    t("skills.skillPage.entry", {
      level: levelName(content, observation.level),
      date: dayName(t, observation.observed_at),
    });

  return (
    <section aria-labelledby={titleId} className="rounded-lg border border-line bg-surface p-(--pad)">
      <div className="mb-(--space-3) flex flex-wrap items-baseline justify-between gap-(--space-3)">
        <h2 id={titleId} className="text-section font-bold tracking-[-0.01em]">
          {t("skills.skillPage.history")}
        </h2>
        <span className="text-meta text-ink-3">{t("skills.skillPage.newestFirst")}</span>
      </div>
      <p className="mb-(--space-4) max-w-[72ch] text-ink-2">{t("skills.skillPage.historyLead")}</p>
      <Timeline label={t("skills.skillPage.history")}>
        {history.map((item) => {
          if (item.kind === "review") {
            return (
              <TimelineEntry key={item.entry.id} dot="retracted" when={dayName(t, item.entry.reviewed_at)}>
                <ReviewLine item={item} history={history} />
              </TimelineEntry>
            );
          }
          const observation = item.entry;
          const counts = item.status === "counts";
          const cited = observation.evidence.map((id) => {
            const evidence = service.find(id)?.record;
            return evidence?.schema === "evidence/1" ? evidence.title : t("skills.skillPage.removedEvidence");
          });
          return (
            <TimelineEntry
              key={observation.id}
              dot={counts ? observation.provenance : "retracted"}
              when={dayName(t, observation.observed_at)}
            >
              <ObservationLine item={item} content={content} />
              {cited.length === 0 ? null : (
                <p className="mt-1 text-meta text-ink-2">
                  {t("skills.skillPage.cites", { evidence: list.format([...new Set(cited)]) })}
                </p>
              )}
              {counts ? (
                <div className="mt-1.5 flex flex-wrap gap-(--space-1)">
                  {observation.provenance === "self-reported" ? (
                    <Button
                      variant="quiet"
                      size="sm"
                      aria-label={t("skills.skillPage.correctLabel", { entry: describe(observation) })}
                      onClick={() => {
                        onChange({ kind: "correct", observation });
                      }}
                    >
                      <Icon of={Pencil} size="sm" />
                      {t("skills.skillPage.correct")}
                    </Button>
                  ) : null}
                  <Button
                    variant="quiet"
                    size="sm"
                    aria-label={t("skills.skillPage.retractLabel", { entry: describe(observation) })}
                    onClick={() => {
                      onChange({ kind: "retract", observation });
                    }}
                  >
                    <Icon of={Undo2} size="sm" />
                    {t("skills.skillPage.retract")}
                  </Button>
                </div>
              ) : null}
            </TimelineEntry>
          );
        })}
      </Timeline>
    </section>
  );
}

// Correcting or retracting one observation, in place, with focus moved to it.
function ChangePanel({
  service,
  content,
  entry,
  change,
  onDone,
}: {
  readonly service: CoreService;
  readonly content: ContentPack;
  readonly entry: SkillEntry | undefined;
  readonly change: Change;
  readonly onDone: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  const { changed } = useSession();
  const box = useRef<HTMLDivElement>(null);
  const [level, setLevel] = useState<number | undefined>(undefined);
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: async (): Promise<"saved" | "changed-outside" | "failed"> => {
      const { observation } = change;
      const result =
        change.kind === "correct"
          ? await service.correctLevel(observation.id, {
              level: level ?? observation.level,
              evidence: observation.evidence,
            })
          : await service.retractLevel(observation.id, ...(note.trim() === "" ? [] : [note.trim()]));
      changed();
      if (result.ok) {
        onDone();
        return "saved";
      }
      return result.error.kind === "conflict" ? "changed-outside" : "failed";
    },
  });
  useEffect(() => {
    box.current?.focus();
  }, []);

  const correcting = change.kind === "correct";
  return (
    <div
      ref={box}
      role={correcting ? "group" : "alertdialog"}
      aria-labelledby={titleId}
      tabIndex={-1}
      className="grid gap-(--space-3) rounded-lg border border-line-strong bg-surface p-(--pad)"
    >
      <h2 id={titleId} className="text-section font-bold">
        {correcting ? t("skills.skillPage.correctTitle") : t("skills.skillPage.retractTitle")}
      </h2>
      <p className="text-ink-2">
        {correcting ? t("skills.skillPage.correctLead") : t("skills.skillPage.retractLead")}
      </p>
      {correcting ? (
        <LevelChoice content={content} skill={entry} value={level} onChange={setLevel} />
      ) : (
        <TextAreaField
          label={t("skills.skillPage.retractNote")}
          rows={2}
          value={note}
          onChange={(event) => {
            setNote(event.currentTarget.value);
          }}
        />
      )}
      {save.data === "changed-outside" ? (
        <ChangedOutsideNotice title={t("skills.skillPage.changedOutside")} />
      ) : save.data === "failed" || save.isError ? (
        <Notice tone="problem" title={t("skills.skillPage.failed")} />
      ) : null}
      <div className="flex flex-wrap gap-(--space-2)">
        <Button
          variant="primary"
          disabled={save.isPending || (correcting && level === undefined)}
          onClick={() => {
            save.mutate();
          }}
        >
          {correcting ? t("skills.skillPage.saveCorrection") : t("skills.skillPage.retractConfirm")}
        </Button>
        <Button onClick={onDone}>
          {correcting ? t("skills.skillPage.cancel") : t("skills.skillPage.keep")}
        </Button>
      </div>
    </div>
  );
}
