/**
 * The activity log: every AI call made with the open profile in this session (MVP S17, PRD J3, D4).
 *
 * @packageDocumentation
 */
import { useId, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { setAsideReason } from "../ai/problems.ts";
import { useSession, type LoggedCall } from "../profile/session.tsx";
import { AiMark } from "../ui/ai-mark.tsx";
import { PageTitle } from "../ui/page-title.tsx";

const TASKS = ["check-model", "normalise-evidence", "suggest-skill-links", "judge-skill-level"] as const;

/**
 * The activity log: each AI call this session, newest first, with its task, model, time and outcome, and in full
 * what was sent and what came back (MVP S17.1, S17.2).
 *
 * @remarks The calls are kept in memory only, so nothing sent is copied into the person's storage; closing the
 * profile or reloading the page forgets them (S17.3). A record written from a call carries its summary in its `ai`
 * block instead (hard rule 2).
 * @returns The log, or a note that there are no calls yet.
 */
export function ActivityPage(): ReactElement {
  const { t } = useTranslation();
  const { calls } = useSession();
  const listId = useId();
  // Newest first by when each call was made; calls can end in another order, as a scan's run alongside others.
  const newest = [...calls].sort((a, b) => Date.parse(b.call.at) - Date.parse(a.call.at) || b.id - a.id);

  return (
    <>
      <PageTitle title={t("activity.title")} lead={t("activity.lead")} />
      <div className="grid max-w-[880px] gap-(--space-4)">
        <p className="text-ink-2">{t("activity.memory")}</p>
        {newest.length === 0 ? (
          <p className="text-ink-2">{t("activity.none")}</p>
        ) : (
          <>
            <h2 id={listId} className="sr-only">
              {t("activity.list")}
            </h2>
            <ul aria-labelledby={listId} className="grid gap-(--space-3)">
              {newest.map((logged) => (
                <CallEntry key={logged.id} logged={logged} />
              ))}
            </ul>
          </>
        )}
      </div>
    </>
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
  const outcome = decision ?? (scan && call.outcome === "answered" ? "inReview" : call.outcome);
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
