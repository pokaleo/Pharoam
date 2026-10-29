/**
 * One skill: its shown level, and its history with corrections and retractions (MVP S7, S8.2, S9.1).
 *
 * @packageDocumentation
 */
import type { ContentPack, CoreService, HistoryItem, Observation, SkillEntry } from "@pharoam/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../profile/session.tsx";
import { dayName, levelName, sourceName } from "../skills/labels.ts";
import { LevelChoice } from "../skills/level-choice.tsx";
import { Button, buttonClassName } from "../ui/button.tsx";
import { ChangedOutsideNotice } from "../ui/changed-outside.tsx";
import { TextAreaField } from "../ui/field.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";

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
        <Link to="/skills" className="text-channel underline">
          {t("skills.skillPage.back")}
        </Link>
      </>
    );
  }
  const name = item?.name ?? entry?.name ?? skill;

  return (
    <>
      <PageTitle title={name} lead={description ?? item?.domain ?? entry?.domain ?? ""} />
      <div className="grid max-w-[72ch] gap-(--space-5)">
        {item?.custom === true ? (
          <p>
            <span className="rounded-sm bg-panel px-1.5 text-meta text-ink-2">{t("skills.own")}</span>
          </p>
        ) : null}
        <div className="grid gap-(--space-1) rounded-lg bg-panel p-(--pad)">
          {item?.shown === undefined ? (
            <p className="text-ink-2">
              {item === undefined ? t("skills.skillPage.noRecord") : t("skills.skillPage.noCount")}
            </p>
          ) : (
            <>
              <p data-shown-level className="text-section font-bold">
                {levelName(content, item.shown.level)}{" "}
                <span className="font-normal text-ink-3">{item.shown.level}</span>
              </p>
              <p className="text-meta text-ink-2">
                {t("skills.since", {
                  source: sourceName(t, item.shown.provenance),
                  date: dayName(t, item.shown.since),
                })}
              </p>
            </>
          )}
        </div>
        <div>
          <Link to="/skills/record" search={{ skill }} className={buttonClassName("primary")}>
            {t("skills.record")}
          </Link>
        </div>
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
  const observations = new Map(
    history.flatMap((item) => (item.kind === "observation" ? [[item.entry.id, item.entry] as const] : [])),
  );
  const describe = (observation: Observation): string =>
    t("skills.skillPage.entry", {
      level: levelName(content, observation.level),
      date: dayName(t, observation.observed_at),
    });

  return (
    <section aria-labelledby={titleId} className="grid gap-(--space-3)">
      <h2 id={titleId} className="text-section font-bold">
        {t("skills.skillPage.history")}
      </h2>
      <p className="text-ink-2">{t("skills.skillPage.historyLead")}</p>
      <ul
        aria-label={t("skills.skillPage.history")}
        className="grid divide-y divide-line-soft rounded-lg bg-surface"
      >
        {history.map((item) => {
          const marks = [
            ...(item.kind === "observation" && item.shown ? [t("skills.skillPage.shownMark")] : []),
            ...(item.kind === "observation" && item.status === "superseded"
              ? [t("skills.skillPage.superseded")]
              : []),
            ...(item.kind === "observation" && item.status === "retracted"
              ? [t("skills.skillPage.retracted")]
              : []),
            ...(item.integrity.kind === "intact" ? [] : [t("skills.skillPage.editedOutside")]),
          ];
          if (item.kind === "review") {
            const target = observations.get(item.entry.target);
            const date = target === undefined ? item.entry.target : dayName(t, target.observed_at);
            return (
              <li key={item.entry.id} className="grid gap-1 px-(--pad) py-(--space-3)">
                <p>
                  {item.entry.note === undefined
                    ? t("skills.skillPage.retraction", { date })
                    : t("skills.skillPage.retractionNote", { date, note: item.entry.note })}
                </p>
                <p className="text-meta text-ink-2">{dayName(t, item.entry.reviewed_at)}</p>
                <Marks marks={marks} />
              </li>
            );
          }
          const observation = item.entry;
          const cited = observation.evidence.map((id) => {
            const evidence = service.find(id)?.record;
            return evidence?.schema === "evidence/1" ? evidence.title : t("skills.skillPage.removedEvidence");
          });
          return (
            <li key={observation.id} className="grid gap-1 px-(--pad) py-(--space-3)">
              <p>
                <span className="font-semibold">{levelName(content, observation.level)}</span>{" "}
                <span className="text-ink-3">{observation.level}</span>
              </p>
              <p className="text-meta text-ink-2">
                {sourceName(t, observation.provenance)} · {dayName(t, observation.observed_at)}
              </p>
              {cited.length === 0 ? null : (
                <p className="text-meta text-ink-2">
                  {t("skills.skillPage.cites", { evidence: list.format([...new Set(cited)]) })}
                </p>
              )}
              <Marks marks={marks} />
              {item.status !== "counts" ? null : (
                <div className="flex flex-wrap gap-(--space-2)">
                  {observation.provenance === "self-reported" ? (
                    <Button
                      variant="quiet"
                      aria-label={t("skills.skillPage.correctLabel", { entry: describe(observation) })}
                      onClick={() => {
                        onChange({ kind: "correct", observation });
                      }}
                    >
                      {t("skills.skillPage.correct")}
                    </Button>
                  ) : null}
                  <Button
                    variant="quiet"
                    aria-label={t("skills.skillPage.retractLabel", { entry: describe(observation) })}
                    onClick={() => {
                      onChange({ kind: "retract", observation });
                    }}
                  >
                    {t("skills.skillPage.retract")}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Marks({ marks }: { readonly marks: readonly string[] }): ReactElement | null {
  if (marks.length === 0) return null;
  return (
    <p className="flex flex-wrap gap-(--space-1)">
      {marks.map((mark) => (
        <span key={mark} className="rounded-sm bg-panel px-1.5 text-meta text-ink-2">
          {mark}
        </span>
      ))}
    </p>
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
