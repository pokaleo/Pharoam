/**
 * Taking a question-bank diagnostic of one skill: how it works, one question at a time, and the result with its
 * path (MVP S19).
 *
 * @packageDocumentation
 */
import type {
  ContentPack,
  CoreService,
  DiagnosticError,
  DiagnosticOutcome,
  DiagnosticView,
  McqItem,
} from "@pharoam/core";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { useEffect, useId, useMemo, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../profile/session.tsx";
import { assessmentWriter } from "../profile/writers.ts";
import { levelName } from "../skills/labels.ts";
import { Level } from "../skills/level.tsx";
import { SourceTag } from "../skills/source-tag.tsx";
import { AiMark } from "../ui/ai-mark.tsx";
import { Button, buttonClassName } from "../ui/button.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";

/**
 * A question-bank diagnostic of one skill, from how it works to its result (MVP S19.1–S19.6).
 *
 * @remarks Nothing is written until the person starts. Each answer is kept in the diagnostic's session record, so
 * leaving and coming back resumes at the same question; the marking is shown only at the end (S19.2). The result
 * is written with no acceptance step, as `demonstrated` assessment evidence (S19.5), and shown with the path taken
 * and the note that the person's evidence wasn't considered (S19.4). It needs no AI (S19.8).
 * @param props - The open profile's service and the skill's slug.
 * @returns The diagnostic's page, once the content pack has loaded.
 */
export function DiagnosticPage({
  service,
  skill,
}: {
  readonly service: CoreService;
  readonly skill: string;
}): ReactElement | null {
  const { services } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  if (content.data === undefined) return null;
  return <Diagnostic service={service} skill={skill} content={content.data} />;
}

// A question bank's prompts and options can hold code, whose line breaks and indentation must survive.
const KEEP_LINES = "whitespace-pre-wrap";

/** Where the person is in the diagnostic. */
type Step =
  | { readonly step: "intro" }
  | { readonly step: "question"; readonly view: DiagnosticView & { readonly item: McqItem } }
  | { readonly step: "finish"; readonly view: DiagnosticView }
  | { readonly step: "result"; readonly outcome: DiagnosticOutcome };

// Where a diagnostic in progress stands, or the start when there is none. One whose posed question has left the
// bank starts again from the intro, whose Start resumes it with a new question.
function stepOf(view: DiagnosticView | undefined): Step {
  if (view === undefined) return { step: "intro" };
  const { item } = view;
  if (item !== undefined) return { step: "question", view: { ...view, item } };
  return view.finishing ? { step: "finish", view } : { step: "intro" };
}

function Diagnostic({
  service,
  skill,
  content,
}: {
  readonly service: CoreService;
  readonly skill: string;
  readonly content: ContentPack;
}): ReactElement {
  const { t } = useTranslation();
  const { changed } = useSession();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState<Step>(() => stepOf(service.diagnosticInProgress(skill)));
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const acting = useRef(false);
  const name = content.skills.find((one) => one.slug === skill)?.name ?? skill;
  const writer = useMemo(() => assessmentWriter(t, (level) => levelName(content, level)), [t, content]);

  // The step changed in place, so focus moves to its title for keyboard and screen reader users; not on arrival,
  // which StrictMode's second run of the effect would otherwise count as a change.
  const key = step.step === "question" ? `question-${String(step.view.asked)}` : step.step;
  const shownKey = useRef(key);
  useEffect(() => {
    if (shownKey.current === key) return;
    shownKey.current = key;
    heading.current?.focus();
  }, [key]);

  // Runs one change, showing why it failed if it did; one at a time, so a second click does nothing.
  const act = async (change: () => Promise<void>): Promise<void> => {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    setProblem(undefined);
    try {
      await change();
    } finally {
      acting.current = false;
      setBusy(false);
    }
  };
  // After any failure the page shows where the diagnostic really is, as its session record holds it: an answer may
  // have been saved before a later write failed.
  const fail = (error: DiagnosticError): void => {
    changed();
    setStep(stepOf(service.diagnosticInProgress(skill)));
    if (error.kind === "not-posed" || error.kind === "not-in-progress") return;
    setProblem(
      t(
        error.kind === "conflict"
          ? "diagnostic.changedOutside"
          : error.kind === "not-covered"
            ? "diagnostic.notCovered"
            : error.kind === "finishing"
              ? "diagnostic.finishing"
              : "diagnostic.failed",
        { skill: name },
      ),
    );
  };

  if (!service.bankCovers(skill)) {
    return (
      <>
        <PageTitle
          title={t("diagnostic.title", { skill: name })}
          lead={t("diagnostic.notCovered", { skill: name })}
          crumbs={[
            <Link key="skills" to="/skills">
              {t("skills.title")}
            </Link>,
          ]}
          crumbsLabel={t("app.crumbs")}
        />
        <Link to="/skills/$skill" params={{ skill }} className="text-channel underline">
          {t("diagnostic.back", { skill: name })}
        </Link>
      </>
    );
  }

  const title =
    step.step === "result"
      ? t("diagnostic.resultTitle", { skill: name })
      : step.step === "finish"
        ? t("diagnostic.finishTitle")
        : t("diagnostic.title", { skill: name });
  const lead =
    step.step === "intro"
      ? t("diagnostic.lead", { skill: name })
      : step.step === "finish"
        ? t("diagnostic.finishLead")
        : step.step === "question"
          ? t("diagnostic.leaveHint")
          : t("diagnostic.note");

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
        {problem === undefined ? null : <Notice tone="problem" title={problem} />}
        {step.step === "intro" ? (
          <Intro
            service={service}
            skill={skill}
            content={content}
            busy={busy}
            onStart={() =>
              void act(async () => {
                const started = await service.startDiagnostic(skill);
                changed();
                if (!started.ok) {
                  fail(started.error);
                  return;
                }
                setStep(stepOf(started.value));
              })
            }
          />
        ) : null}
        {step.step === "question" ? (
          <Question
            key={step.view.item.slug}
            view={step.view}
            skill={skill}
            busy={busy}
            onAnswer={(answer) =>
              void act(async () => {
                const next = await service.answerDiagnostic(
                  step.view.location,
                  step.view.item.slug,
                  answer,
                  writer,
                );
                changed();
                if (!next.ok) {
                  fail(next.error);
                  return;
                }
                setStep(
                  next.value.kind === "end"
                    ? { step: "result", outcome: next.value.outcome }
                    : stepOf(next.value.view),
                );
              })
            }
            onAbandon={() =>
              void act(async () => {
                const abandoned = await service.abandonDiagnostic(step.view.location);
                changed();
                if (!abandoned.ok) {
                  fail(abandoned.error);
                  return;
                }
                await navigate({ to: "/skills/$skill", params: { skill } });
              })
            }
          />
        ) : null}
        {step.step === "finish" ? (
          <div>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  const finished = await service.finishDiagnostic(step.view.location, writer);
                  changed();
                  if (!finished.ok) {
                    fail(finished.error);
                    return;
                  }
                  setStep({ step: "result", outcome: finished.value });
                })
              }
            >
              {t("diagnostic.finish")}
            </Button>
          </div>
        ) : null}
        {step.step === "result" ? (
          <Result outcome={step.outcome} skill={skill} name={name} content={content} />
        ) : null}
      </div>
    </>
  );
}

function Intro({
  service,
  skill,
  content,
  busy,
  onStart,
}: {
  readonly service: CoreService;
  readonly skill: string;
  readonly content: ContentPack;
  readonly busy: boolean;
  readonly onStart: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  // The shown level, from the skill's entries as the core works it out, so the wording matches where it starts.
  const shown = service.shownLevel(skill);
  const start = service.diagnosticStart(skill) ?? 2;
  const level = t("diagnostic.record.level", { name: levelName(content, start), level: start });
  return (
    <>
      <section
        aria-labelledby={titleId}
        className="grid gap-(--space-2) rounded-lg border border-line bg-surface p-(--pad)"
      >
        <h2 id={titleId} className="text-section font-bold">
          {t("diagnostic.how")}
        </h2>
        <ul className="grid list-disc gap-(--space-1) ps-5">
          <li>{t("diagnostic.rules.one")}</li>
          <li>{t("diagnostic.rules.adapt")}</li>
          <li>{t("diagnostic.rules.rule")}</li>
          <li>{t("diagnostic.rules.evidence")}</li>
          <li>
            {t(shown === undefined ? "diagnostic.rules.startNone" : "diagnostic.rules.start", { level })}
          </li>
        </ul>
      </section>
      <div>
        <Button variant="primary" disabled={busy} onClick={onStart}>
          {t("diagnostic.start")}
        </Button>
      </div>
    </>
  );
}

function Question({
  view,
  skill,
  busy,
  onAnswer,
  onAbandon,
}: {
  readonly view: DiagnosticView & { readonly item: McqItem };
  readonly skill: string;
  readonly busy: boolean;
  readonly onAnswer: (answer: number) => void;
  readonly onAbandon: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const name = useId();
  const confirmId = useId();
  const abandonId = useId();
  const confirmTitle = useRef<HTMLHeadingElement>(null);
  const [chosen, setChosen] = useState<number>();
  const [abandoning, setAbandoning] = useState(false);
  const { item } = view;
  // The confirmation appears in place, so focus moves to it for keyboard and screen reader users.
  useEffect(() => {
    if (abandoning) confirmTitle.current?.focus();
  }, [abandoning]);
  return (
    <>
      <form
        className="grid gap-(--space-3) rounded-lg border border-line bg-surface p-(--pad)"
        onSubmit={(event) => {
          event.preventDefault();
          if (chosen !== undefined) onAnswer(chosen);
        }}
      >
        <p className="text-meta font-semibold text-ink-2">
          {t("diagnostic.question", { number: view.asked + 1 })}
        </p>
        <fieldset className="grid gap-(--space-2)">
          <legend className={`mb-(--space-2) text-body font-semibold ${KEEP_LINES}`}>{item.prompt}</legend>
          {item.options.map((option, index) => (
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
          ))}
        </fieldset>
        <div className="flex flex-wrap items-center gap-(--space-2)">
          <Button type="submit" variant="primary" disabled={busy || chosen === undefined}>
            {t("diagnostic.answer")}
          </Button>
          <Link to="/skills/$skill" params={{ skill }} className={buttonClassName("secondary")}>
            {t("diagnostic.leave")}
          </Link>
          <Button
            id={abandonId}
            variant="quiet"
            disabled={busy}
            onClick={() => {
              setAbandoning(true);
            }}
          >
            {t("diagnostic.abandon")}
          </Button>
        </div>
      </form>
      {abandoning ? (
        <section
          aria-labelledby={confirmId}
          className="grid gap-(--space-2) rounded-lg border border-line bg-surface p-(--pad)"
        >
          <h2 id={confirmId} ref={confirmTitle} tabIndex={-1} className="font-semibold focus:outline-none">
            {t("diagnostic.abandonTitle")}
          </h2>
          <p className="text-ink-2">{t("diagnostic.abandonLead")}</p>
          <div className="flex flex-wrap gap-(--space-2)">
            <Button variant="primary" disabled={busy} onClick={onAbandon}>
              {t("diagnostic.abandonConfirm")}
            </Button>
            <Button
              onClick={() => {
                setAbandoning(false);
                // Back to the button that opened it, which stays on screen.
                document.getElementById(abandonId)?.focus();
              }}
            >
              {t("diagnostic.keepGoing")}
            </Button>
          </div>
        </section>
      ) : null}
    </>
  );
}

function Result({
  outcome,
  skill,
  name,
  content,
}: {
  readonly outcome: DiagnosticOutcome;
  readonly skill: string;
  readonly name: string;
  readonly content: ContentPack;
}): ReactElement {
  const { t } = useTranslation();
  const resultId = useId();
  const pathId = useId();
  return (
    <>
      <section aria-labelledby={resultId} className="grid gap-(--space-2) rounded-lg bg-panel p-(--pad)">
        <h2 id={resultId} className="text-meta font-semibold text-ink-2">
          {t("diagnostic.resultRegion")}
        </h2>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <SourceTag provenance="demonstrated" />
          <Level level={outcome.result} name={levelName(content, outcome.result)} source="demonstrated" />
        </p>
      </section>
      <section className="grid gap-(--space-2)">
        <h2 id={pathId} className="text-section font-bold">
          {t("diagnostic.path")}
        </h2>
        <ol aria-labelledby={pathId} className="grid gap-(--space-2)">
          {outcome.steps.map((step, index) => (
            <PathStep key={`${step.item}-${String(index)}`} t={t} step={step} content={content} />
          ))}
        </ol>
      </section>
      <div className="flex flex-wrap gap-(--space-2)">
        <Link to="/skills/$skill" params={{ skill }} className={buttonClassName("primary")}>
          {t("diagnostic.back", { skill: name })}
        </Link>
        <Link
          to="/evidence/$id"
          params={{ id: outcome.evidence.record.id }}
          className={buttonClassName("secondary")}
        >
          {t("diagnostic.seeRecord")}
        </Link>
      </div>
      <MoreAccurate skill={skill} />
    </>
  );
}

// After a question-bank result, what an AI-led diagnostic adds, with a way to it, or that it needs a model (S21.2).
function MoreAccurate({ skill }: { readonly skill: string }): ReactElement {
  const { t } = useTranslation();
  const { model } = useSession();
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="grid gap-(--space-2) rounded-lg border border-dashed border-ai-edge bg-surface p-(--pad)"
    >
      <h2 id={titleId} className="flex items-center gap-(--space-1) font-semibold">
        <AiMark />
        {t("diagnostic.moreAccurate.title")}
      </h2>
      <p className="text-ink-2">{t("diagnostic.moreAccurate.lead")}</p>
      <ul className="grid list-disc gap-(--space-1) ps-5 text-ink-2">
        <li>{t("diagnostic.moreAccurate.questions")}</li>
        <li>{t("diagnostic.moreAccurate.answers")}</li>
        <li>{t("diagnostic.moreAccurate.explained")}</li>
      </ul>
      {model === undefined ? (
        <p className="text-ink-2">
          {t("diagnostic.moreAccurate.noModel")}{" "}
          <Link to="/settings" className="text-channel underline">
            {t("diagnostic.moreAccurate.setUp")}
          </Link>
        </p>
      ) : (
        <div>
          <Link to="/skills/$skill/ai-diagnostic" params={{ skill }} className={buttonClassName("secondary")}>
            {t("skills.skillPage.aiMoreAccurate")}
          </Link>
        </div>
      )}
    </section>
  );
}

// One question asked, with the answer chosen and its marking, and the explanation from the bank.
function PathStep({
  t,
  step,
  content,
}: {
  readonly t: TFunction;
  readonly step: DiagnosticOutcome["steps"][number];
  readonly content: ContentPack;
}): ReactElement {
  const item = content.items.find((one): one is McqItem => one.format === "mcq" && one.slug === step.item);
  const option = (index: number): string => item?.options[index] ?? String(index);
  return (
    <li className="grid gap-1 rounded-lg border border-line bg-surface p-(--pad)">
      <p className={`font-semibold ${KEEP_LINES}`}>{item?.prompt ?? step.item}</p>
      <p className={`text-ink-2 ${KEEP_LINES}`}>
        {t("diagnostic.yourAnswer", { answer: option(step.answer) })}
      </p>
      <p data-marking className="font-semibold">
        {t(step.correct ? "diagnostic.right" : "diagnostic.notRight")}
      </p>
      {step.correct || item === undefined ? null : (
        <p className={`text-ink-2 ${KEEP_LINES}`}>
          {t("diagnostic.rightAnswer", { answer: option(item.answer) })}
        </p>
      )}
      {item === undefined ? null : <p className="text-ink-2">{item.explanation}</p>}
    </li>
  );
}
