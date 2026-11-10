/**
 * What a gap might mean: an AI explanation of the gap to a pathway, kept only as a note the person accepts (MVP S18).
 *
 * @packageDocumentation
 */
import {
  explainGap,
  runTask,
  type AiProvenance,
  type CoreService,
  type GapExplanationCall,
  type GapView,
  type PathwayDetail,
} from "@pharoam/core";
import { Link } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactElement, type ReactNode, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { taskProblem } from "../ai/problems.ts";
import { useSession } from "../profile/session.tsx";
import { dayName } from "../skills/labels.ts";
import { AiMark } from "../ui/ai-mark.tsx";
import { Button } from "../ui/button.tsx";
import { TextAreaField } from "../ui/field.tsx";
import { Icon } from "../ui/icon.tsx";
import { Markdown } from "../ui/markdown.tsx";
import { Notice } from "../ui/notice.tsx";
import { Tag } from "../ui/tag.tsx";

/** An answer shown in the card, not yet accepted or discarded. */
interface Answer {
  readonly step: "answer";
  readonly prepared: GapExplanationCall;
  readonly ai: AiProvenance;
  /** The call that answered, in the activity log. */
  readonly call: number;
  /** The explanation as Markdown, as the model gave it or the person edited it. */
  readonly text: string;
  readonly editing: boolean;
  /** While the note is being saved, so it can't be saved twice or changed meanwhile. */
  readonly saving: boolean;
  /** Why it couldn't be saved; cleared once the person edits it. */
  readonly problem?: string | undefined;
}

/** Where the card is: resting, getting the call ready, checking what will be sent, sending, or showing an answer. */
type Step =
  | { readonly step: "rest"; readonly problem?: string; readonly saved?: string }
  | { readonly step: "preparing" }
  | { readonly step: "confirm"; readonly prepared: GapExplanationCall }
  | { readonly step: "sending"; readonly prepared: GapExplanationCall }
  | Answer;

/**
 * The gap view's card for what the gap might mean: the latest note, or an explanation to ask for, check and keep.
 *
 * @remarks Asking shows exactly what will be sent first: the pathway by name, and where the person stands with the
 * titles of the evidence their levels cite (MVP S18.1). The answer is labelled with its model and the disclaimer, and
 * names only the pathway's requirements; it changes no level and shows no score (S18.2, Charter R1). It is written
 * only if the person accepts it, perhaps edited, as a new note; discarding writes nothing (S18.3, S18.4). The latest
 * note shows on coming back, saying so once the gap has moved on (S18.5). Every call goes in the activity log, with
 * what the person did with it; an answer left undecided counts as discarded (S17.1).
 * @param props - The open profile's service, the pathway, and what to do with the gap once brought up to date.
 * @returns The card.
 */
export function GapMeaning({
  service,
  pathway,
  onGap,
}: {
  readonly service: CoreService;
  readonly pathway: PathwayDetail;
  readonly onGap: (gap: GapView) => void;
}): ReactElement {
  const { t } = useTranslation();
  const { model, services, changed, logCall, decideCall } = useSession();
  const titleId = useId();
  const title = useRef<HTMLHeadingElement>(null);
  const confirmTitle = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState<Step>({ step: "rest" });
  const note = service.latestGapNote(pathway.slug);
  const provider = model === undefined ? "" : t(`settings.model.names.${model.choice.kind}`);
  const modelName = model === undefined ? "" : (model.name ?? model.model);

  // The answer still waiting for a decision, and whether the card is still shown, so leaving counts as discarding.
  const undecided = useRef<number | undefined>(undefined);
  const alive = useRef(true);
  const decide = useRef(decideCall);
  useEffect(() => {
    decide.current = decideCall;
  }, [decideCall]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (undecided.current !== undefined) decide.current(undecided.current, "discarded");
      undecided.current = undefined;
    };
  }, []);

  // The step changed in place, so focus moves to its heading for keyboard and screen reader users; not on arrival.
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) {
      moved.current = true;
      return;
    }
    if (step.step === "confirm") confirmTitle.current?.focus();
    else if (step.step === "rest" || step.step === "answer") title.current?.focus();
  }, [step.step]);

  const prepare = async (): Promise<void> => {
    setStep({ step: "preparing" });
    const prepared = await service.explainGapCall(pathway.slug);
    changed();
    if (!prepared.ok) {
      const problem = prepared.error.kind === "conflict" ? t("gap.changedOutside") : t("gap.failed");
      setStep({ step: "rest", problem });
      return;
    }
    onGap(prepared.value.gap);
    setStep({ step: "confirm", prepared: prepared.value });
  };

  const send = async (prepared: GapExplanationCall): Promise<void> => {
    if (model === undefined) return;
    setStep({ step: "sending", prepared });
    let loaded;
    try {
      loaded = await services.providers(model.choice);
    } catch {
      setStep({ step: "rest", problem: t("ai.loadFailed", { provider }) });
      return;
    }
    const answer = await runTask(loaded, explainGap, prepared.input, {
      model: model.model,
      now: () => new Date(),
    });
    const call = logCall(answer.ok ? answer.value.call : answer.error.call);
    if (!answer.ok) {
      setStep({ step: "rest", problem: taskProblem(t, answer.error.reason, provider) });
      return;
    }
    if (!alive.current) {
      decideCall(call, "discarded");
      return;
    }
    undecided.current = call;
    const text = explanationText(t, answer.value.output, pathway);
    setStep({ step: "answer", prepared, ai: answer.value.ai, call, text, editing: false, saving: false });
  };

  const accept = async (current: Answer): Promise<void> => {
    if (current.saving) return;
    setStep({ ...current, saving: true });
    const { prepared, ai, text, call } = current;
    const saved = await service.saveGapNote(
      { pathway: prepared.pathway, gapUpdated: prepared.gapUpdated, ai },
      text,
      t("gap.meaning.noteDisclaimer"),
    );
    if (!saved.ok) {
      const problem =
        saved.error.kind === "empty-note" ? t("gap.meaning.empty") : t("gap.meaning.saveFailed");
      setStep({ ...current, saving: false, problem });
      return;
    }
    undecided.current = undefined;
    decideCall(call, "accepted");
    changed();
    setStep({ step: "rest", saved: saved.value.location });
  };

  const resting = step.step === "rest" || step.step === "preparing";
  const by =
    step.step === "answer" ? step.ai.model : resting && note !== undefined ? note.ai.model : undefined;

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col rounded-lg border border-dashed border-ai-edge bg-surface"
    >
      <div className="flex flex-wrap items-center gap-2 rounded-t-lg border-b border-dashed border-ai-edge bg-src-ai-wash bg-(image:--ai-hatch) px-(--pad) py-2 text-meta text-src-ai">
        <Tag tone="ai-judged" mark={<AiMark />}>
          {by === undefined ? t("gap.meaning.mark") : t("gap.meaning.written", { model: by })}
        </Tag>
      </div>
      <div className="grid flex-1 content-start gap-(--space-3) p-(--pad)">
        <h2
          id={titleId}
          ref={title}
          tabIndex={-1}
          className="text-section font-bold tracking-[-0.01em] focus:outline-none"
        >
          {t("gap.meaning.title")}
        </h2>
        {resting ? (
          <>
            {step.step === "rest" && step.problem !== undefined ? (
              <Notice tone="problem" title={t("gap.meaning.failed")}>
                {step.problem}
              </Notice>
            ) : null}
            {note === undefined ? (
              <p className="max-w-(--reading-measure) text-ink-2">{t("gap.meaning.lead")}</p>
            ) : (
              <>
                {/* Part of the page each time it is shown, so not announced as an alert. */}
                {note.outOfDate ? <Notice tone="info" title={t("gap.meaning.outOfDate")} /> : null}
                <Markdown text={note.text} />
                <p className="text-meta text-ink-2">
                  {t("gap.meaning.accepted", { date: dayName(t, note.created), model: note.ai.model })}
                </p>
              </>
            )}
            <Disclaimer />
            {model === undefined ? (
              <p className="text-ink-2">
                {t("gap.meaning.noModel")}{" "}
                <Link to="/settings" className="text-channel underline">
                  {t("gap.meaning.setUp")}
                </Link>
              </p>
            ) : (
              <div>
                <Button disabled={step.step === "preparing"} onClick={() => void prepare()}>
                  {note === undefined ? t("gap.meaning.ask") : t("gap.meaning.again")}
                </Button>
              </div>
            )}
          </>
        ) : null}
        {step.step === "confirm" || step.step === "sending" ? (
          <Confirm
            prepared={step.prepared}
            pathway={pathway.title}
            model={modelName}
            provider={provider}
            sending={step.step === "sending"}
            titleRef={confirmTitle}
            onSend={() => void send(step.prepared)}
            onCancel={() => {
              setStep({ step: "rest" });
            }}
          />
        ) : null}
        {step.step === "answer" ? (
          <>
            {step.problem === undefined ? null : <Notice tone="problem" title={step.problem} />}
            {step.editing ? (
              <TextAreaField
                label={t("gap.meaning.editLabel")}
                hint={t("gap.meaning.editHint")}
                rows={10}
                value={step.text}
                disabled={step.saving}
                onChange={(event) => {
                  setStep({ ...step, text: event.currentTarget.value, problem: undefined });
                }}
              />
            ) : (
              <Markdown text={step.text} />
            )}
            <p className="text-meta text-ink-2">{t("gap.meaning.unsaved", { model: step.ai.model })}</p>
            <Disclaimer />
            <div className="flex flex-wrap gap-(--space-2)">
              <Button variant="primary" disabled={step.saving} onClick={() => void accept(step)}>
                {t("gap.meaning.accept")}
              </Button>
              <Button
                disabled={step.saving}
                onClick={() => {
                  setStep({ ...step, editing: !step.editing });
                }}
              >
                {step.editing ? t("gap.meaning.preview") : t("gap.meaning.edit")}
              </Button>
              <Button
                variant="quiet"
                disabled={step.saving}
                onClick={() => {
                  undecided.current = undefined;
                  decideCall(step.call, "discarded");
                  setStep({ step: "rest" });
                }}
              >
                {t("gap.meaning.discard")}
              </Button>
            </div>
          </>
        ) : null}
        {/* One status region, always there, so each change to it is announced. */}
        <p role="status" className="text-meta text-ink-2 empty:hidden">
          {statusText(t, step, modelName)}
        </p>
      </div>
    </section>
  );
}

// What the status region says at each step.
function statusText(t: TFunction, step: Step, model: string): string {
  switch (step.step) {
    case "sending":
      return t("gap.meaning.asking", { model });
    case "answer":
      return step.saving ? "" : t("gap.meaning.ready");
    case "rest":
      return step.saved === undefined ? "" : t("gap.meaning.saved", { file: step.saved });
    case "preparing":
    case "confirm":
      return "";
  }
}

// The answer as the Markdown the note will hold. The model's text can't add headings or break out of its list item,
// so the note keeps the card's structure: what it might mean, then the places to start.
function explanationText(
  t: TFunction,
  answer: { readonly meaning: string; readonly starts: readonly { skill: string; why: string }[] },
  pathway: PathwayDetail,
): string {
  const names = new Map<string, string>(pathway.requirements.map(({ skill, name }) => [skill, name]));
  const meaning = answer.meaning.replace(/^[ \t]*#{1,6}[ \t]+/gm, "").trim();
  if (answer.starts.length === 0) return meaning;
  const starts = answer.starts.map(({ skill, why }) =>
    t("gap.meaning.start", { name: names.get(skill) ?? skill, why: why.replace(/\s+/g, " ").trim() }),
  );
  return [meaning, `### ${t("gap.meaning.starts")}`, starts.join("\n")].join("\n\n");
}

function Disclaimer(): ReactElement {
  const { t } = useTranslation();
  return (
    <p className="flex gap-1.5 text-meta text-ink-2">
      <Icon of={Info} size="sm" className="mt-px" />
      {t("gap.meaning.disclaimer")}
    </p>
  );
}

// What will be sent, shown before anything is (MVP S18.1, PRD D4): the pathway by name, since it and Pharoam's
// instructions are content, and the person's own part in full.
function Confirm({
  prepared,
  pathway,
  model,
  provider,
  sending,
  titleRef,
  onSend,
  onCancel,
}: {
  readonly prepared: GapExplanationCall;
  readonly pathway: string;
  readonly model: string;
  readonly provider: string;
  readonly sending: boolean;
  readonly titleRef: Ref<HTMLHeadingElement>;
  readonly onSend: () => void;
  readonly onCancel: () => void;
}): ReactNode {
  const { t } = useTranslation();
  const titleId = useId();
  const number = new Intl.NumberFormat(t("app.locale"));
  return (
    <>
      <section aria-labelledby={titleId} className="grid gap-(--space-2)">
        <h3 id={titleId} ref={titleRef} tabIndex={-1} className="font-semibold focus:outline-none">
          {t("gap.meaning.send.title")}
        </h3>
        <p className="text-ink-2">{t("gap.meaning.send.lead", { pathway, provider })}</p>
        {prepared.call.parts.map((part) => (
          <div key={part.kind} className="grid gap-(--space-1)">
            <h4 className="text-meta font-semibold text-ink-2">{t("gap.meaning.send.part")}</h4>
            <pre
              dir="auto"
              className="rounded-md bg-panel px-3 py-2 font-mono text-[13px] break-words whitespace-pre-wrap"
            >
              {part.text}
            </pre>
          </div>
        ))}
        <p className="text-ink-2">{t("ai.send.size", { size: number.format(prepared.call.size) })}</p>
        <p className="text-ink-2">{t("ai.send.model", { model, provider })}</p>
      </section>
      {sending ? null : (
        <div className="flex flex-wrap gap-(--space-2)">
          <Button variant="primary" onClick={onSend}>
            {t("gap.meaning.send.send")}
          </Button>
          <Button onClick={onCancel}>{t("gap.meaning.send.cancel")}</Button>
        </div>
      )}
    </>
  );
}
