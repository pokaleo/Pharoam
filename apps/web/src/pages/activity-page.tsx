/**
 * The activity log: every AI call made with the open profile in this session, and every read and write of its
 * storage (MVP S17, S22, PRD J3, D4).
 *
 * @packageDocumentation
 */
import { useId, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { setAsideReason } from "../ai/problems.ts";
import type { StorageEvent } from "../profile/observed-storage.ts";
import { useSession, type LoggedCall, type LoggedStorage } from "../profile/session.tsx";
import { AiMark } from "../ui/ai-mark.tsx";
import { PageTitle } from "../ui/page-title.tsx";

const TASKS = [
  "check-model",
  "normalise-evidence",
  "suggest-skill-links",
  "judge-skill-level",
  "explain-gap",
  "write-diagnostic-item",
  "mark-diagnostic-answer",
  "explain-diagnostic",
] as const;

// An AI-led diagnostic's tasks, whose answers it uses as they come, with no step to accept (MVP S23.4).
const DIAGNOSTIC: readonly string[] = [
  "write-diagnostic-item",
  "mark-diagnostic-answer",
  "explain-diagnostic",
];

/**
 * The activity log: each AI call and each read and write of the person's storage this session, newest first
 * (MVP S17.1, S17.2, S22.1, S22.2).
 *
 * @remarks An AI call shows its task, model, time and outcome, and in full what was sent and what came back. A
 * storage event shows what was done, where and when, and whether it worked; a run of reads is one entry, so opening
 * a profile doesn't bury the rest. Everything is kept in memory only, so nothing is copied into the person's
 * storage; closing the profile or reloading the page forgets it (S17.3). A record written from a call carries its
 * summary in its `ai` block instead (hard rule 2).
 * @returns The log, with a note when there are no AI calls yet.
 */
export function ActivityPage(): ReactElement {
  const { t } = useTranslation();
  const { calls, storage } = useSession();
  const listId = useId();
  // Newest first, in the order each ended: calls and storage events share one count.
  const entries: Entry[] = [
    ...calls.map((logged): Entry => ({ kind: "call", id: logged.id, logged })),
    ...storageEntries(storage),
  ].sort((a, b) => b.id - a.id);

  return (
    <>
      <PageTitle title={t("activity.title")} lead={t("activity.lead")} />
      <div className="grid max-w-[880px] gap-(--space-4)">
        <p className="text-ink-2">{t("activity.memory")}</p>
        {calls.length === 0 ? <p className="text-ink-2">{t("activity.none")}</p> : null}
        {entries.length === 0 ? null : (
          <>
            <h2 id={listId} className="sr-only">
              {t("activity.list")}
            </h2>
            <ul aria-labelledby={listId} className="grid gap-(--space-3)">
              {entries.map((entry) =>
                entry.kind === "call" ? (
                  <CallEntry key={entry.id} logged={entry.logged} />
                ) : (
                  <StorageEntry key={entry.id} entry={entry} />
                ),
              )}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

/** One entry in the log: an AI call, or one or more storage events shown together. */
type Entry =
  | { readonly kind: "call"; readonly id: number; readonly logged: LoggedCall }
  | {
      readonly kind: "storage";
      /** The last event's ID, which places the entry in the log. */
      readonly id: number;
      /** `opened`: a listing and the reads after it; `reads`: a run of reads; `one`: any other event. */
      readonly group: "opened" | "reads" | "one";
      readonly events: readonly StorageEvent[];
    };

// Storage events as entries: a listing with the reads right after it is one entry, as is a run of reads, so
// opening a profile of many records reads as one line (MVP S22.1). Only events next to each other are joined:
// calls share the count, so a gap in it means something else happened between.
function storageEntries(storage: readonly LoggedStorage[]): Entry[] {
  const entries: Extract<Entry, { kind: "storage" }>[] = [];
  for (const { id, event } of storage) {
    const last = entries.at(-1);
    if (event.action === "read" && last !== undefined && last.group !== "one" && last.id === id - 1) {
      entries[entries.length - 1] = { ...last, id, events: [...last.events, event] };
      continue;
    }
    const group = event.action === "listed" ? "opened" : event.action === "read" ? "reads" : "one";
    entries.push({ kind: "storage", id, group, events: [event] });
  }
  return entries;
}

function StorageEntry({ entry }: { readonly entry: Extract<Entry, { kind: "storage" }> }): ReactElement {
  const { t } = useTranslation();
  const when = new Intl.DateTimeFormat(t("app.locale"), { dateStyle: "medium", timeStyle: "medium" });
  const reads = entry.events.filter((event) => event.action === "read");
  const last = entry.events.at(-1);
  const failed = entry.events.some((event) => !event.ok);
  // An opening is counted by what its listing found, which includes records that couldn't be read.
  const listed = entry.events[0]?.count ?? reads.length;
  const title =
    entry.group === "opened"
      ? t("activity.storage.opened", { count: listed })
      : entry.group === "reads"
        ? t("activity.storage.reads", { count: reads.length })
        : last?.action === "copied"
          ? t("activity.storage.copied", { count: last.count ?? 0 })
          : t(`activity.storage.actions.${last?.action ?? "read"}`);
  return (
    <li className="grid gap-(--space-2) rounded-lg border border-line bg-surface p-(--pad)">
      <div className="flex flex-wrap items-baseline justify-between gap-(--space-2)">
        <h3 className="font-semibold">{title}</h3>
        {failed ? <span className="text-meta font-semibold">{t("activity.storage.failed")}</span> : null}
      </div>
      <p className="flex flex-wrap gap-x-(--space-2) text-meta text-ink-2">
        <span>{t("activity.storage.kind")}</span>
        <span>{last === undefined ? "" : when.format(new Date(last.at))}</span>
      </p>
      {entry.group === "one" ? (
        last === undefined || last.location === "" ? null : (
          <p className="font-mono text-meta break-all text-ink-2">{last.location}</p>
        )
      ) : (
        <details>
          <summary className="cursor-pointer text-meta text-channel">{t("activity.storage.which")}</summary>
          <ul className="mt-(--space-1) grid gap-1 font-mono text-meta break-all text-ink-2">
            {reads.map((event, index) => (
              <li key={`${event.location}-${String(index)}`}>
                {event.location}
                {event.ok ? null : (
                  <span className="ms-(--space-2) font-sans font-semibold">
                    {t("activity.storage.failed")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

function CallEntry({ logged }: { readonly logged: LoggedCall }): ReactElement {
  const { t } = useTranslation();
  const { call, decision } = logged;
  const ids = useId();
  const name = call.task.split("@")[0] ?? call.task;
  const known = TASKS.find((one) => one === name);
  const when = new Intl.DateTimeFormat(t("app.locale"), { dateStyle: "medium", timeStyle: "medium" });
  // A scan's answer becomes suggestions, each decided in Review rather than here.
  const scan = name === "suggest-skill-links" || name === "judge-skill-level";
  const answered = call.outcome === "answered";
  const outcome =
    decision ??
    (scan && answered ? "inReview" : DIAGNOSTIC.includes(name) && answered ? "inDiagnostic" : call.outcome);
  const size = new Intl.NumberFormat(t("app.locale")).format(
    call.sent.system.length + call.sent.prompt.length,
  );
  const received =
    "answer" in call.received
      ? ((JSON.stringify(call.received.answer, null, 2) as string | undefined) ?? t("activity.nothing"))
      : t("activity.error", { reason: setAsideReason(t, call.received.error.kind) });
  const task = known === undefined ? t("activity.tasks.other") : t(`activity.tasks.${known}`);
  const time = when.format(new Date(call.at));

  return (
    <li className="grid gap-(--space-2) rounded-lg border border-line bg-surface p-(--pad)">
      <div className="flex flex-wrap items-baseline justify-between gap-(--space-2)">
        <h3 className="flex items-center gap-(--space-1) font-semibold">
          <AiMark />
          {task}
        </h3>
        <span className="text-meta font-semibold">{t(`activity.outcomes.${outcome}`)}</span>
      </div>
      <p className="text-meta text-ink-2">
        {t("activity.meta", { model: call.model, time, task: call.task })}
      </p>
      <p className="text-meta text-ink-2">{t("activity.size", { size })}</p>
      <details>
        <summary className="cursor-pointer text-meta text-channel">
          {t("activity.details")}
          <span className="sr-only">{`, ${task}, ${time}`}</span>
        </summary>
        <div className="mt-(--space-2) grid gap-(--space-2)">
          <Block id={`${ids}-material`} title={t("activity.material")} text={call.sent.prompt} own />
          <Block id={`${ids}-instructions`} title={t("activity.instructions")} text={call.sent.system} />
          <Block
            id={`${ids}-shape`}
            title={t("activity.shape")}
            text={JSON.stringify(call.sent.output, null, 2)}
          />
          <Block id={`${ids}-received`} title={t("activity.received")} text={received} own />
        </div>
      </details>
    </li>
  );
}

// One part of a call, shown exactly as text, never rendered (hard rule 10). The person's material and the model's
// answer keep their own direction, as text in any language may be; Pharoam's own text and JSON read left to right.
function Block({
  id,
  title,
  text,
  own = false,
}: {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly own?: boolean;
}): ReactElement {
  return (
    <div className="grid gap-1">
      <h4 id={id} className="text-meta font-semibold text-ink-2">
        {title}
      </h4>
      <pre
        aria-labelledby={id}
        dir={own ? "auto" : "ltr"}
        className="rounded-md bg-panel px-3 py-2 font-mono text-[13px] break-words whitespace-pre-wrap [direction:ltr] [text-align:left]"
      >
        {text}
      </pre>
    </div>
  );
}
