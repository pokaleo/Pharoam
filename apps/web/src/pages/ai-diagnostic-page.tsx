/**
 * Taking an AI-led diagnostic of one skill: how it works, what each call will send, one question at a time, and the
 * explained result (MVP S23).
 *
 * @packageDocumentation
 */
import {
  MAX_QUESTIONS,
  QUESTION_BANK_RULE,
  type AiDiagnosticView,
  type AiDiagnosticError,
  type AiDiagnosticOutcome,
  type AiDiagnosticTurnResult,
  type AiLedItem,
  type AiLedPause,
  type AiLedTurn,
  type Approval,
  type ContentPack,
  type CoreService,
  type ModelProvider,
} from "@pharoam/core";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { Info } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { taskProblem } from "../ai/problems.ts";
import type { ModelSetup } from "../ai/providers.ts";
import { useSession } from "../profile/session.tsx";
import { aiAssessmentWriter } from "../profile/writers.ts";
import { levelName } from "../skills/labels.ts";
import { Level } from "../skills/level.tsx";
import { SourceTag } from "../skills/source-tag.tsx";
import { AiMark } from "../ui/ai-mark.tsx";
import { Button, buttonClassName } from "../ui/button.tsx";
import { TextAreaField } from "../ui/field.tsx";
import { Icon } from "../ui/icon.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";
import { Tag } from "../ui/tag.tsx";

/**
 * An AI-led diagnostic of one skill, from how it works to its explained result (MVP S23.1–S23.5).
 *
 * @remarks Nothing is written until the person starts, and nothing is sent until they agree to each call, having
 * seen exactly what it sends and to which model (S23.1). Each turn is kept in the diagnostic's session record, so
 * leaving and coming back goes on where it was (S23.5). A bank question's answer is marked by its key with no call;
 * a written answer only once the person agrees to send it (S23.2). The result, the published rule's level with the
 * model's explanation, is written with no acceptance step, labelled with its model and the disclaimer (S23.3, S23.4).
 * Every call goes in the activity log.
 * @param props - The open profile's service and the skill's slug.
 * @returns The diagnostic's page, once the content pack has loaded.
 */
export function AiDiagnosticPage({
  service,
  skill,
}: {
  readonly service: CoreService;
  readonly skill: string;
}): ReactElement | null {
  const { services } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  if (content.data === undefined) return null;
  return <AiDiagnostic service={service} skill={skill} content={content.data} />;
}

// Questions and answers can hold code, whose line breaks and indentation must survive.
const KEEP_LINES = "whitespace-pre-wrap";

/** Where the person is: before starting or going on, or at a pause of the diagnostic. */
type Step =
  | { readonly step: "intro" }
  | { readonly step: "pause"; readonly location: string; readonly result: AiDiagnosticTurnResult };

function AiDiagnostic({
  service,
  skill,
  content,
}: {
  readonly service: CoreService;
  readonly skill: string;
  readonly content: ContentPack;
}): ReactElement {
  const { t } = useTranslation();
  const { changed, model, services, logCall } = useSession();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState<Step>({ step: "intro" });
  const [problem, setProblem] = useState<string>();
  // Counts each problem shown, so the same one again is a new alert, announced again.
  const [tries, setTries] = useState(0);
  // Counts the turns taken, so a notice shown again after another turn is a new alert.
  const [turns, setTurns] = useState(0);
  const [busy, setBusy] = useState(false);
  const acting = useRef(false);
  const name = content.skills.find((one) => one.slug === skill)?.name ?? skill;
  const provider = model === undefined ? "" : t(`settings.model.names.${model.choice.kind}`);
  const writer = useMemo(() => aiAssessmentWriter(t, (level) => levelName(content, level)), [t, content]);
  const running = service.aiDiagnosticInProgress(skill);

  // The step changed in place, so focus moves to the title for keyboard and screen reader users.
  const key = step.step === "intro" ? "intro" : `${step.result.pause.kind}-${String(step.result.view.asked)}`;
  const shownKey = useRef(key);
  useEffect(() => {
    if (shownKey.current === key) return;
    shownKey.current = key;
    heading.current?.focus();
  }, [key]);

  // Runs one change, showing why it failed if it did; one at a time, so a second click does nothing.
  const act = async (change: (loaded: ModelProvider, setup: ModelSetup) => Promise<void>): Promise<void> => {
    if (acting.current || model === undefined) return;
    acting.current = true;
    setBusy(true);
    setProblem(undefined);
    try {
      let loaded: ModelProvider;
      try {
        loaded = await services.providers(model.choice);
      } catch {
        setProblem(t("ai.loadFailed", { provider }));
        return;
      }
      await change(loaded, model);
    } finally {
      acting.current = false;
      setBusy(false);
    }
  };

  // After any failure the page shows where the diagnostic really is, as its session record holds it: back to the
  // intro, which can go on with it or abandon it, when no step of it is on screen or it has ended elsewhere.
  const fail = (error: AiDiagnosticError): void => {
    changed();
    if (service.aiDiagnosticInProgress(skill) === undefined || step.step === "intro")
      setStep({ step: "intro" });
    setProblem(problemText(t, error, name));
    setTries((n) => n + 1);
  };

  const turn = (location: string, given: AiLedTurn): void =>
    void act(async (loaded) => {
      const taken = await service.aiDiagnosticTurn(location, given, loaded, { writer, onCall: logCall });
      changed();
      if (!taken.ok) {
        fail(taken.error);
        return;
      }
      setStep({ step: "pause", location, result: taken.value });
      setTurns((n) => n + 1);
    });

  const begin = (): void =>
    void act(async (loaded, setup) => {
      const started = await service.startAiDiagnostic(skill, loaded, setup.model);
      changed();
      if (!started.ok) {
        fail(started.error);
        return;
      }
      const { location } = started.value;
      const taken = await service.aiDiagnosticTurn(location, {}, loaded, { writer, onCall: logCall });
      changed();
      if (!taken.ok) {
        fail(taken.error);
        return;
      }
      setStep({ step: "pause", location, result: taken.value });
    });

  const abandon = (location: string): void =>
    void act(async () => {
      const abandoned = await service.abandonDiagnostic(location);
      changed();
      if (!abandoned.ok) {
        fail(abandoned.error);
        return;
      }
      await navigate({ to: "/skills/$skill", params: { skill } });
    });

  const pause = step.step === "pause" ? step.result.pause : undefined;
  const title =
    pause?.kind === "explained"
      ? t("aiDiagnostic.resultTitle", { skill: name })
      : t("aiDiagnostic.title", { skill: name });
  const lead =
    pause === undefined
      ? t("aiDiagnostic.lead")
      : pause.kind === "explained"
        ? t("aiDiagnostic.ruleNote")
        : t("aiDiagnostic.leaveHint");

  return (
    <>
      <PageTitle
        title={title}
        lead={lead}
        titleRef={heading}
        crumbs={[
          <Link key="skills" to="/skills">
            {t("skills.title")}
          </Link>,
          <Link key="skill" to="/skills/$skill" params={{ skill }}>
            {name}
          </Link>,
        ]}
        crumbsLabel={t("app.crumbs")}
      />
      <div className="grid max-w-[880px] gap-(--space-4)">
        {problem === undefined ? null : <Notice key={tries} tone="problem" title={problem} />}
        {step.step === "intro" ? (
          <Intro
            service={service}
            skill={skill}
            content={content}
            model={model}
            provider={provider}
            busy={busy}
            running={running}
            onStart={() => {
              if (running === undefined) begin();
              else turn(running.location, {});
            }}
            onAbandon={() => {
              if (running !== undefined) abandon(running.location);
            }}
          />
        ) : null}
        {step.step === "pause" && pause !== undefined ? (
          <Paused
            pause={pause}
            result={step.result}
            content={content}
            skill={skill}
            name={name}
            provider={provider}
            busy={busy}
            attempt={tries + turns}
            onTurn={(given) => {
              turn(step.location, given);
            }}
            onAbandon={() => {
              abandon(step.location);
            }}
          />
        ) : null}
        {/* One status region, always there, so each change to it is announced. */}
        <p role="status" className="text-meta text-ink-2 empty:hidden">
          {busy ? t("aiDiagnostic.working", { model: running?.model ?? model?.model ?? "" }) : ""}
        </p>
      </div>
    </>
  );
}

function Intro({
  service,
  skill,
  content,
  model,
  provider,
  busy,
  running,
  onStart,
  onAbandon,
}: {
  readonly service: CoreService;
  readonly skill: string;
  readonly content: ContentPack;
  readonly model: ModelSetup | undefined;
  readonly provider: string;
  readonly busy: boolean;
  /** The diagnostic in progress, if there is one: the intro then describes it, not a new one. */
  readonly running: AiDiagnosticView | undefined;
  readonly onStart: () => void;
  readonly onAbandon: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  const shown = service.skillView(content.skills).find((one) => one.skill === skill)?.shown;
  const start = running?.start ?? shown?.level ?? 2;
  const level = t("diagnostic.record.level", { name: levelName(content, start), level: start });
  return (
    <>
      <section
        aria-labelledby={titleId}
        className="grid gap-(--space-2) rounded-lg border border-line bg-surface p-(--pad)"
      >
        <h2 id={titleId} className="text-section font-bold">
          {t("aiDiagnostic.how")}
        </h2>
        <ul className="grid list-disc gap-(--space-1) ps-5">
          <li>{t("aiDiagnostic.rules.model")}</li>
          <li>{t("aiDiagnostic.rules.send")}</li>
          <li>{t("aiDiagnostic.rules.rule", { rule: QUESTION_BANK_RULE, max: MAX_QUESTIONS })}</li>
          {running === undefined ? (
            <>
              <li>
                {t(shown === undefined ? "aiDiagnostic.rules.startNone" : "aiDiagnostic.rules.start", {
                  level,
                })}
              </li>
              {model === undefined ? null : (
                <li>{t("aiDiagnostic.rules.using", { model: model.name ?? model.model, provider })}</li>
              )}
            </>
          ) : (
            <li>{t("aiDiagnostic.rules.resumed", { model: running.model, level })}</li>
          )}
        </ul>
      </section>
      {model === undefined ? (
        <p className="text-ink-2">
          {t("aiDiagnostic.noModel")}{" "}
          <Link to="/settings" className="text-channel underline">
            {t("aiDiagnostic.setUp")}
          </Link>
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-(--space-2)">
        {model === undefined ? null : (
          <Button variant="primary" disabled={busy} onClick={onStart}>
            {running === undefined ? t("aiDiagnostic.start") : t("aiDiagnostic.continue")}
          </Button>
        )}
        {/* One in progress can always be abandoned, even when it can't go on (MVP S23.5). */}
        {running === undefined ? null : <Leaving busy={busy} onAbandon={onAbandon} />}
      </div>
    </>
  );
}

// Why a change didn't happen, in the person's words.
function problemText(t: TFunction, error: AiDiagnosticError, skill: string): string {
  // A storage failure carries its reason; the diagnostic's own `unavailable` is its code not loading.
  if ("reason" in error) return t("aiDiagnostic.errors.storage");
  const known = [
    "other-model",
    "material-changed",
    "unavailable",
    "conflict",
    "not-covered",
    "not-in-progress",
    "finishing",
    "needs-attention",
  ] as const;
  const kind = known.find((one) => one === error.kind) ?? "other";
  return t(`aiDiagnostic.errors.${kind}`, { skill, model: "model" in error ? error.model : "" });
}

// The diagnostic at a pause: a call to approve, a question to answer, a failed call, or the explained result.
function Paused({
  pause,
  result,
  content,
  skill,
  name,
  provider,
  busy,
  attempt,
  onTurn,
  onAbandon,
}: {
  readonly pause: AiLedPause;
  readonly result: AiDiagnosticTurnResult;
  readonly content: ContentPack;
  readonly skill: string;
  readonly name: string;
  readonly provider: string;
  readonly busy: boolean;
  /** Counts the turns shown, so a notice shown again after another try is a new alert, announced again. */
  readonly attempt: number;
  readonly onTurn: (turn: AiLedTurn) => void;
  readonly onAbandon: () => void;
}): ReactElement {
  const { t } = useTranslation();
  if (pause.kind === "explained")
    return <Result result={result} content={content} skill={skill} name={name} />;
  const leaving = <Leaving skill={skill} busy={busy} onAbandon={onAbandon} />;
  // A question dropped because its bank item changed: the person's answer to it wasn't counted (MVP S23.2).
  const dropped =
    result.dropped === undefined ? null : (
      <Notice key={`dropped-${String(attempt)}`} tone="attention" title={t("aiDiagnostic.dropped")} />
    );
  if (pause.kind === "answer")
    return (
      <>
        {dropped}
        <Question
          key={`${String(result.view.asked)}-${pause.posed.prompt}`}
          posed={pause.posed}
          number={result.view.asked + 1}
          busy={busy}
          leaving={leaving}
          onAnswer={(answer) => {
            onTurn({ answer });
          }}
        />
      </>
    );
  const approval: Approval = { call: pause.call, model: pause.model };
  return (
    <>
      {dropped}
      {pause.kind === "failed" ? (
        <Notice key={`failed-${String(attempt)}`} tone="problem" title={t("aiDiagnostic.failed")}>
          {taskProblem(t, pause.failure.reason, provider)}
        </Notice>
      ) : null}
      {pause.kind === "approve" && pause.stale ? (
        <Notice key={`stale-${String(attempt)}`} tone="attention" title={t("aiDiagnostic.send.stale")} />
      ) : null}
      <WhatWillBeSent approval={approval} content={content} provider={provider} />
      <div className="flex flex-wrap items-center gap-(--space-2)">
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => {
            onTurn({ approve: approval });
          }}
        >
          {pause.kind === "failed" ? t("aiDiagnostic.tryAgain") : t("aiDiagnostic.send.send")}
        </Button>
        {leaving}
      </div>
    </>
  );
}

// What a call will send, in full, with its size and model, before anything is (MVP S23.1, PRD D4).
function WhatWillBeSent({
  approval,
  content,
  provider,
}: {
  readonly approval: Approval;
  readonly content: ContentPack;
  readonly provider: string;
}): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  const number = new Intl.NumberFormat(t("app.locale"));
  const { call } = approval;
  const task = call.task.split("@")[0] ?? call.task;
  // Choosing a question names its level, the first one the instructions give.
  const level = /level (\d)/.exec(call.request.system)?.[1];
  const at =
    level === undefined
      ? ""
      : t("diagnostic.record.level", { name: levelName(content, Number(level)), level: Number(level) });
  const tasks = ["write-diagnostic-item", "mark-diagnostic-answer", "explain-diagnostic"] as const;
  const known = tasks.find((one) => one === task) ?? "other-task";
  const parts = ["skill", "evidence", "claims", "earlier-results", "question", "item", "answer"] as const;
  return (
    <section
      aria-labelledby={titleId}
      className="grid gap-(--space-2) rounded-lg border border-line bg-surface p-(--pad)"
    >
      <h2 id={titleId} className="text-section font-bold">
        {t("aiDiagnostic.send.title")}
      </h2>
      <p className="font-semibold">{t(`aiDiagnostic.send.${known}`, { level: at })}</p>
      {call.parts.map((part, index) => (
        <div key={`${part.kind}-${String(index)}`} className="grid gap-(--space-1)">
          <h3 className="text-meta font-semibold text-ink-2">
            {t(`aiDiagnostic.send.parts.${parts.find((one) => one === part.kind) ?? "other"}`)}
          </h3>
          <pre
            dir="auto"
            className="rounded-md bg-panel px-3 py-2 font-mono text-[13px] break-words whitespace-pre-wrap"
          >
            {part.text}
          </pre>
        </div>
      ))}
      <p className="text-ink-2">{t("ai.send.size", { size: number.format(call.size) })}</p>
      <p className="text-ink-2">
        {t("ai.send.model", { model: approval.model.split("/").slice(1).join("/"), provider })}
      </p>
    </section>
  );
}

function Question({
  posed,
  number,
  busy,
  leaving,
  onAnswer,
}: {
  readonly posed: AiLedItem;
  readonly number: number;
  readonly busy: boolean;
  readonly leaving: ReactElement;
  readonly onAnswer: (answer: number | string) => void;
}): ReactElement {
  const { t } = useTranslation();
  const name = useId();
  const [chosen, setChosen] = useState<number>();
  const [text, setText] = useState("");
  const ready = posed.format === "mcq" ? chosen !== undefined : /\S/.test(text);
  return (
    <form
      className="grid gap-(--space-3) rounded-lg border border-line bg-surface p-(--pad)"
      onSubmit={(event) => {
        event.preventDefault();
        if (posed.format === "mcq") {
          if (chosen !== undefined) onAnswer(chosen);
        } else if (/\S/.test(text)) onAnswer(text);
      }}
    >
      <p className="text-meta font-semibold text-ink-2">{t("aiDiagnostic.question", { number })}</p>
      {/* The question in a group named by it, so its answer, chosen or written, is tied to it. */}
      <fieldset className="grid gap-(--space-2)">
        <legend className={`mb-(--space-2) text-body font-semibold ${KEEP_LINES}`}>{posed.prompt}</legend>
        {posed.format === "mcq" ? (
          posed.options.map((option, index) => (
            <label key={String(index)} className="flex items-start gap-(--space-2)">
              <input
                type="radio"
                name={name}
                className="mt-1"
                checked={chosen === index}
                onChange={() => {
                  setChosen(index);
                }}
              />
              <span className={KEEP_LINES}>{option}</span>
            </label>
          ))
        ) : (
          <TextAreaField
            label={t("aiDiagnostic.yourAnswer")}
            rows={8}
            value={text}
            disabled={busy}
            onChange={(event) => {
              setText(event.currentTarget.value);
            }}
          />
        )}
      </fieldset>
      <Chosen posed={posed} />
      <div className="flex flex-wrap items-center gap-(--space-2)">
        <Button type="submit" variant="primary" disabled={busy || !ready}>
          {t("aiDiagnostic.answer")}
        </Button>
        {leaving}
      </div>
    </form>
  );
}

// Which model chose the question, where it came from and why, labelled as AI with its disclaimer (hard rule 6).
function Chosen({ posed }: { readonly posed: AiLedItem }): ReactElement {
  const { t } = useTranslation();
  return (
    <div className="grid gap-(--space-1) rounded-md border border-dashed border-ai-edge bg-src-ai-wash p-(--space-2) text-meta">
      <p className="flex flex-wrap items-center gap-(--space-2)">
        <Tag tone="ai-judged" mark={<AiMark />}>
          {t("aiDiagnostic.chosenBy", { model: posed.chosen.model })}
        </Tag>
        <span className="text-ink-2">
          {t(posed.source === "written" ? "aiDiagnostic.written" : "aiDiagnostic.bank")}
        </span>
      </p>
      <p className={KEEP_LINES}>{t("aiDiagnostic.why", { why: posed.why })}</p>
      <p className="text-ink-2">{t("aiDiagnostic.chosenNote")}</p>
    </div>
  );
}

// Leaving for now, which keeps everything, and abandoning, which asks first; with no skill, only abandoning.
function Leaving({
  skill,
  busy,
  onAbandon,
}: {
  readonly skill?: string;
  readonly busy: boolean;
  readonly onAbandon: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const confirmId = useId();
  const abandonId = useId();
  const confirmTitle = useRef<HTMLHeadingElement>(null);
  const [abandoning, setAbandoning] = useState(false);
  // The confirmation appears in place, so focus moves to it for keyboard and screen reader users.
  useEffect(() => {
    if (abandoning) confirmTitle.current?.focus();
  }, [abandoning]);
  return (
    <>
      {skill === undefined ? null : (
        <Link to="/skills/$skill" params={{ skill }} className={buttonClassName("secondary")}>
          {t("aiDiagnostic.leave")}
        </Link>
      )}
      <Button
        id={abandonId}
        variant="quiet"
        disabled={busy}
        onClick={() => {
          setAbandoning(true);
        }}
      >
        {t("aiDiagnostic.abandon")}
      </Button>
      {abandoning ? (
        <section
          aria-labelledby={confirmId}
          className="grid basis-full gap-(--space-2) rounded-lg border border-line bg-surface p-(--pad)"
        >
          <h2 id={confirmId} ref={confirmTitle} tabIndex={-1} className="font-semibold focus:outline-none">
            {t("aiDiagnostic.abandonTitle")}
          </h2>
          <p className="text-ink-2">{t("aiDiagnostic.abandonLead")}</p>
          <div className="flex flex-wrap gap-(--space-2)">
            <Button variant="primary" disabled={busy} onClick={onAbandon}>
              {t("aiDiagnostic.abandonConfirm")}
            </Button>
            <Button
              onClick={() => {
                setAbandoning(false);
                // Back to the button that opened it, which stays on screen.
                document.getElementById(abandonId)?.focus();
              }}
            >
              {t("aiDiagnostic.keepGoing")}
            </Button>
          </div>
        </section>
      ) : null}
    </>
  );
}

function Result({
  result,
  content,
  skill,
  name,
}: {
  readonly result: AiDiagnosticTurnResult;
  readonly content: ContentPack;
  readonly skill: string;
  readonly name: string;
}): ReactElement {
  const { t } = useTranslation();
  const resultId = useId();
  const explanationId = useId();
  const pathId = useId();
  const { outcome } = result;
  if (outcome === undefined) return <></>;
  const { explanation, considered } = outcome;
  const level = (value: number): string =>
    t("diagnostic.record.level", { name: levelName(content, value), level: value });
  const consideredLines = [
    ...considered.evidence.map(({ title }) => t("aiDiagnostic.consideredEvidence", { title })),
    ...considered.claims.map(({ level: value, provenance, since }) =>
      t("aiDiagnostic.consideredClaim", {
        level: level(value),
        source: t(`skills.sources.${provenance}`),
        since,
      }),
    ),
    ...considered.earlier.map(({ level: value, date }) =>
      t("aiDiagnostic.consideredEarlier", { level: level(value), date }),
    ),
  ];
  return (
    <>
      <section aria-labelledby={resultId} className="grid gap-(--space-2) rounded-lg bg-panel p-(--pad)">
        <h2 id={resultId} className="text-meta font-semibold text-ink-2">
          {t("aiDiagnostic.resultRegion")}
        </h2>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <SourceTag provenance="ai-correlated" />
          <Level level={outcome.result} name={levelName(content, outcome.result)} source="ai-correlated" />
        </p>
      </section>
      <section
        aria-labelledby={explanationId}
        className="flex flex-col rounded-lg border border-dashed border-ai-edge bg-surface"
      >
        <div className="flex flex-wrap items-center gap-2 rounded-t-lg border-b border-dashed border-ai-edge bg-src-ai-wash bg-(image:--ai-hatch) px-(--pad) py-2 text-meta text-src-ai">
          <Tag tone="ai-judged" mark={<AiMark />}>
            {t("aiDiagnostic.explainedBy", { model: explanation.ai.model })}
          </Tag>
        </div>
        <div className="grid gap-(--space-3) p-(--pad)">
          <h2 id={explanationId} className="text-section font-bold">
            {t("aiDiagnostic.explanation")}
          </h2>
          <Said title={t("aiDiagnostic.showed")} text={explanation.showed} />
          <Said title={t("aiDiagnostic.comparison")} text={explanation.comparison} />
          {explanation.reasons.length === 0 ? null : (
            <div className="grid gap-(--space-1)">
              <h3 className="font-semibold">{t("aiDiagnostic.reasons")}</h3>
              <ul className="grid list-disc gap-(--space-1) ps-5">
                {explanation.reasons.map((reason, index) => (
                  <li key={String(index)}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          <Said title={t("aiDiagnostic.nextStep")} text={explanation.next_step} />
          <div className="grid gap-(--space-1)">
            <h3 className="font-semibold">{t("aiDiagnostic.considered")}</h3>
            {consideredLines.length === 0 ? (
              <p className="text-ink-2">{t("aiDiagnostic.consideredNothing")}</p>
            ) : (
              <ul className="grid list-disc gap-(--space-1) ps-5">
                {consideredLines.map((line, index) => (
                  <li key={String(index)}>{line}</li>
                ))}
              </ul>
            )}
          </div>
          <p className="flex gap-1.5 text-meta text-ink-2">
            <Icon of={Info} size="sm" className="mt-px" />
            {t("aiDiagnostic.disclaimer")}
          </p>
        </div>
      </section>
      <section className="grid gap-(--space-2)">
        <h2 id={pathId} className="text-section font-bold">
          {t("aiDiagnostic.path")}
        </h2>
        <ol aria-labelledby={pathId} className="grid gap-(--space-2)">
          {outcome.steps.map((one, index) => (
            <PathStep key={String(index)} t={t} step={one} />
          ))}
        </ol>
      </section>
      <div className="flex flex-wrap gap-(--space-2)">
        <Link to="/skills/$skill" params={{ skill }} className={buttonClassName("primary")}>
          {t("aiDiagnostic.back", { skill: name })}
        </Link>
        <Link
          to="/evidence/$id"
          params={{ id: outcome.evidence.record.id }}
          className={buttonClassName("secondary")}
        >
          {t("aiDiagnostic.seeRecord")}
        </Link>
      </div>
    </>
  );
}

// One part of the explanation, under its heading.
function Said({ title, text }: { readonly title: string; readonly text: string }): ReactElement {
  return (
    <div className="grid gap-(--space-1)">
      <h3 className="font-semibold">{title}</h3>
      <p className={KEEP_LINES}>{text}</p>
    </div>
  );
}

// One question asked, in full, with the answer and its marking: by the bank's answer key, or by the model, labelled
// as AI with why it marked so (hard rule 6).
function PathStep({
  t,
  step,
}: {
  readonly t: TFunction;
  readonly step: AiDiagnosticOutcome["steps"][number];
}): ReactElement {
  const answer = step.format === "mcq" ? (step.options[step.answer] ?? String(step.answer)) : step.answer;
  return (
    <li className="grid gap-1 rounded-lg border border-line bg-surface p-(--pad)">
      <p className="text-meta text-ink-2">
        {t(step.source === "written" ? "aiDiagnostic.written" : "aiDiagnostic.bank")}
      </p>
      <p className={`font-semibold ${KEEP_LINES}`}>{step.prompt}</p>
      <p className={`text-ink-2 ${KEEP_LINES}`}>{t("aiDiagnostic.yourAnswerWas", { answer })}</p>
      <p data-marking className="font-semibold">
        {t(step.correct ? "aiDiagnostic.right" : "aiDiagnostic.notRight")}
      </p>
      {step.format === "mcq" ? (
        <p className="text-meta text-ink-2">{t("aiDiagnostic.markedByKey")}</p>
      ) : (
        <div className="grid gap-1 text-meta">
          <p>
            <Tag tone="ai-judged" mark={<AiMark />}>
              {t("aiDiagnostic.markedBy", { model: step.marked.model })}
            </Tag>
          </p>
          <p className={`text-ink-2 ${KEEP_LINES}`}>
            {t("aiDiagnostic.markedBecause", { reasons: step.reasons })}
          </p>
        </div>
      )}
    </li>
  );
}
