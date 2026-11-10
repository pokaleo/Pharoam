/**
 * Turning pasted text into evidence: paste, see what will be sent, send, check each record, then save (MVP S15).
 *
 * @packageDocumentation
 */
import {
  MAX_PASTED_CHARACTERS,
  formOfNormalised,
  normaliseEvidence,
  prepareCall,
  runTask,
  type AiProvenance,
  isSameEvidence,
  type CoreService,
  type EvidenceForm,
  type InvalidEvidenceError,
  type PreparedCall,
  type RecordFile,
  type Result,
} from "@pharoam/core";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { taskProblem } from "../ai/problems.ts";
import type { ModelSetup } from "../ai/providers.ts";
import {
  answersFromForm,
  evidenceFormFrom,
  fieldErrorsOf,
  type EvidenceAnswers,
  type FieldErrors,
} from "../evidence/answers.ts";
import { EvidenceFormView } from "../evidence/evidence-form-view.tsx";
import { RecordFileView } from "../evidence/record-file-view.tsx";
import { useSession } from "../profile/session.tsx";
import { skillChoices } from "../profile/skills.ts";
import { AiMark } from "../ui/ai-mark.tsx";
import { Button } from "../ui/button.tsx";
import { TextAreaField } from "../ui/field.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";
import { kindName } from "./evidence-list-page.tsx";

/** One record the model found, as the person is checking it. */
interface Draft {
  /** Tells drafts apart while they are edited. */
  readonly key: number;
  /** Its answers, as the model gave them or the person edited them. */
  readonly form: EvidenceForm;
  /** The record it would be stored as, or the fields to fix. */
  readonly file: Result<RecordFile, InvalidEvidenceError>;
  /** Whether it is saved with the others. */
  readonly include: boolean;
  /**
   * Evidence it looks like: a record the person already has, or a draft found above it in the same answer (MVP
   * S15.4).
   */
  readonly similar: { readonly title: string; readonly found: "profile" | "paste" } | undefined;
}

type Step =
  | { readonly step: "write"; readonly problem?: string }
  | { readonly step: "confirm"; readonly call: PreparedCall }
  | { readonly step: "sending" }
  | {
      readonly step: "review";
      readonly ai: AiProvenance;
      readonly drafts: readonly Draft[];
      /** The call that found them, in the activity log. */
      readonly call: number;
    };

/**
 * The paste page: the text, then what will be sent, then each record found, to edit, leave out or save.
 *
 * @remarks Nothing is sent before the person has seen what will be sent and its size (S15.1), and nothing is written
 * before they confirm (S15.2, hard rule 6). Each record found is shown as the file it will be stored as, labelled as
 * AI-made with its model and disclaimer. A record that looks like one the person already has, or has a field to fix,
 * is left out until they put it back or fix it (S15.3, S15.4). If the call fails, or its answer isn't in the task's
 * shape, nothing is written and the text is still there (S15.6, S15.7). Without a model, it offers to set one up
 * (S13.8).
 * @param props - The open profile's service.
 * @returns The page for the current step.
 */
export function PastePage({ service }: { readonly service: CoreService }): ReactElement {
  const { t } = useTranslation();
  const { model } = useSession();
  const [text, setText] = useState("");
  const [step, setStep] = useState<Step>({ step: "write" });

  if (model === undefined) {
    return (
      <>
        <PageTitle title={t("paste.title")} lead={t("paste.lead")} />
        <Notice tone="info" title={t("paste.noModel")}>
          <Link to="/settings" className="text-channel underline">
            {t("paste.setUp")}
          </Link>
        </Notice>
      </>
    );
  }

  switch (step.step) {
    case "write":
      return (
        <Write
          text={text}
          onText={setText}
          problem={step.problem}
          onContinue={(call) => {
            setStep({ step: "confirm", call });
          }}
        />
      );
    case "confirm":
    case "sending":
      return (
        <Confirm
          service={service}
          setup={model}
          text={text}
          call={step.step === "confirm" ? step.call : undefined}
          onSending={() => {
            setStep({ step: "sending" });
          }}
          onDone={setStep}
        />
      );
    case "review":
      return (
        <Review
          service={service}
          text={text}
          ai={step.ai}
          initial={step.drafts}
          call={step.call}
          onAgain={() => {
            setStep({ step: "write" });
          }}
        />
      );
  }
}

function Write({
  text,
  onText,
  problem,
  onContinue,
}: {
  readonly text: string;
  readonly onText: (text: string) => void;
  readonly problem: string | undefined;
  readonly onContinue: (call: PreparedCall) => void;
}): ReactElement {
  const { t } = useTranslation();
  const [error, setError] = useState<string>();
  const heading = useRef<HTMLHeadingElement>(null);
  const number = new Intl.NumberFormat(t("app.locale"));
  const max = number.format(MAX_PASTED_CHARACTERS);
  useEffect(() => {
    if (problem !== undefined) heading.current?.focus();
  }, [problem]);

  return (
    <>
      <PageTitle
        title={t("paste.title")}
        lead={t("paste.lead")}
        titleRef={heading}
        crumbs={[
          <Link key="evidence" to="/evidence">
            {t("evidence.title")}
          </Link>,
        ]}
        crumbsLabel={t("app.crumbs")}
      />
      <form
        noValidate
        className="grid max-w-[880px] gap-(--space-4)"
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim() === "") setError(t("paste.empty"));
          else if (text.length > MAX_PASTED_CHARACTERS) setError(t("paste.tooLong", { max }));
          else onContinue(prepareCall(normaliseEvidence, { text }));
        }}
      >
        {problem === undefined ? null : (
          <Notice tone="problem" title={t("paste.failed")}>
            {problem}
          </Notice>
        )}
        <TextAreaField
          label={t("paste.text")}
          hint={`${t("paste.textHint", { max })} ${t("paste.count", { count: text.length, max })}`}
          error={error}
          rows={14}
          value={text}
          onChange={(event) => {
            onText(event.currentTarget.value);
            setError(undefined);
          }}
        />
        <div>
          <Button type="submit" variant="primary">
            {t("paste.continue")}
          </Button>
        </div>
      </form>
    </>
  );
}

function Confirm({
  service,
  setup,
  text,
  call,
  onSending,
  onDone,
}: {
  readonly service: CoreService;
  readonly setup: ModelSetup;
  readonly text: string;
  readonly call: PreparedCall | undefined;
  readonly onSending: () => void;
  readonly onDone: (step: Step) => void;
}): ReactElement {
  const { t } = useTranslation();
  const { services, logCall, decideCall } = useSession();
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  // Whether this step is still shown: a call that answers after the person left is logged, but counts as discarded,
  // since nothing from it can be saved (S17.1).
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const provider = t(`settings.model.names.${setup.choice.kind}`);
  const modelName = setup.name ?? setup.model;
  const number = new Intl.NumberFormat(t("app.locale"));
  // The step changed in place, so focus moves to its title for keyboard and screen reader users.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  const send = async (): Promise<void> => {
    onSending();
    let loaded;
    try {
      loaded = await services.providers(setup.choice);
    } catch {
      onDone({ step: "write", problem: t("ai.loadFailed", { provider }) });
      return;
    }
    const answer = await runTask(
      loaded,
      normaliseEvidence,
      { text },
      { model: setup.model, now: () => new Date() },
    );
    const call = logCall(answer.ok ? answer.value.call : answer.error.call);
    if (!alive.current) {
      if (answer.ok) decideCall(call, "discarded");
      return;
    }
    if (!answer.ok) {
      onDone({ step: "write", problem: taskProblem(t, answer.error.reason, provider) });
      return;
    }
    const drafts: Draft[] = [];
    for (const [key, record] of answer.value.output.records.entries())
      drafts.push(draftOf(service, key, formOfNormalised(record), answer.value.ai, t, drafts));
    onDone({ step: "review", ai: answer.value.ai, drafts, call });
  };

  return (
    <>
      <PageTitle title={t("paste.send.title")} lead={t("paste.send.lead", { provider })} titleRef={heading} />
      <div className="grid max-w-[880px] gap-(--space-4)">
        <section
          aria-labelledby={titleId}
          className="grid gap-(--space-3) rounded-lg border border-line bg-surface p-(--pad)"
        >
          <h2 id={titleId} className="text-section font-bold">
            {t("paste.send.title")}
          </h2>
          {(call?.parts ?? []).map((part) => (
            <div key={part.kind} className="grid gap-(--space-1)">
              <h3 className="font-semibold">{t("paste.send.parts.pasted-text")}</h3>
              <pre className="rounded-md bg-panel px-3 py-2 font-mono text-[13px] break-words whitespace-pre-wrap">
                {part.text}
              </pre>
            </div>
          ))}
          {call === undefined ? null : (
            <p className="text-ink-2">{t("ai.send.size", { size: number.format(call.size) })}</p>
          )}
          <p className="text-ink-2">{t("ai.send.model", { model: modelName, provider })}</p>
        </section>
        <p role="status" className="empty:hidden">
          {call === undefined ? t("paste.send.reading", { model: modelName }) : ""}
        </p>
        {call === undefined ? null : (
          <div className="flex flex-wrap gap-(--space-2)">
            <Button variant="primary" onClick={() => void send()}>
              {t("paste.send.send")}
            </Button>
            <Button
              onClick={() => {
                onDone({ step: "write" });
              }}
            >
              {t("paste.send.back")}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

// A record the model found, ready to check: drafted as it would be stored, and left out when it looks like
// evidence already there, or a draft above it, or has a field to fix.
function draftOf(
  service: CoreService,
  key: number,
  form: EvidenceForm,
  ai: AiProvenance,
  t: ReturnType<typeof useTranslation>["t"],
  earlier: readonly Draft[],
): Draft {
  const file = service.draftPastedEvidence(form, {
    ai,
    disclaimer: t("paste.disclaimer"),
    keepOriginal: true,
  });
  const similar = likeness(service, form, earlier);
  return { key, form, file, include: file.ok && similar === undefined, similar };
}

// The evidence a draft looks like: one the person has, or one of the drafts before it (MVP S15.4).
function likeness(service: CoreService, form: EvidenceForm, earlier: readonly Draft[]): Draft["similar"] {
  const stored = service.similarEvidence(form);
  if (stored?.record.schema === "evidence/1") return { title: stored.record.title, found: "profile" };
  const twin = earlier.find((other) => isSameEvidence(other.form, form));
  return twin === undefined ? undefined : { title: twin.form.title, found: "paste" };
}

function Review({
  service,
  text,
  ai,
  initial,
  call,
  onAgain,
}: {
  readonly service: CoreService;
  readonly text: string;
  readonly ai: AiProvenance;
  readonly initial: readonly Draft[];
  /** The call that found the drafts, in the activity log. */
  readonly call: number;
  readonly onAgain: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { services, changed, decideCall } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  const heading = useRef<HTMLHeadingElement>(null);
  const [drafts, setDrafts] = useState(initial);
  const [keepOriginal, setKeepOriginal] = useState(true);
  const [editing, setEditing] = useState<{ key: number; answers: EvidenceAnswers; errors: FieldErrors }>();
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState<{ title: string; count: number }>();
  const formId = useId();
  const included = drafts.filter((draft) => draft.include && draft.file.ok);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  // Until a record is saved, leaving this step, by starting again or going elsewhere, discards the answer (S17.1).
  const accepted = useRef(false);
  const decide = useRef(decideCall);
  useEffect(() => {
    decide.current = decideCall;
  }, [decideCall]);
  useEffect(
    () => () => {
      if (!accepted.current) decide.current(call, "discarded");
    },
    [call],
  );

  const redraft = (draft: Draft, form: EvidenceForm, keep: boolean): Draft => {
    const file = service.draftPastedEvidence(form, {
      ai,
      disclaimer: t("paste.disclaimer"),
      keepOriginal: keep,
    });
    return { ...draft, form, file };
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    setSaveFailed(undefined);
    const original = keepOriginal ? new TextEncoder().encode(text) : undefined;
    const saved: number[] = [];
    for (const draft of included) {
      if (!draft.file.ok) continue;
      const result = await service.savePastedEvidence(draft.file.value, original);
      if (!result.ok) {
        changed();
        setDrafts((all) => all.filter((one) => !saved.includes(one.key)));
        setSaveFailed({ title: draft.form.title, count: saved.length });
        setSaving(false);
        return;
      }
      saved.push(draft.key);
      if (!accepted.current) decideCall(call, "accepted");
      accepted.current = true;
    }
    changed();
    await navigate({ to: "/evidence", state: { pasted: saved.length } });
  };

  if (drafts.length === 0) {
    return (
      <>
        <PageTitle title={t("paste.review.title")} lead={t("paste.review.none")} titleRef={heading} />
        <div>
          <Button onClick={onAgain}>{t("paste.review.again")}</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle
        title={t("paste.review.title")}
        lead={t("paste.review.lead", { count: drafts.length })}
        titleRef={heading}
      />
      <div className="grid max-w-[880px] gap-(--space-4)">
        <Notice tone="info" title={t("paste.review.mistakes")} />
        {drafts.map((draft) => (
          <DraftCard
            key={draft.key}
            draft={draft}
            model={ai.model}
            onInclude={(include) => {
              setDrafts((all) => all.map((one) => (one.key === draft.key ? { ...one, include } : one)));
            }}
            editable={editing === undefined && !saving}
            saving={saving}
            onEdit={() => {
              // A draft that needs a fix opens with what to fix already marked.
              const errors = draft.file.ok ? {} : fieldErrorsOf(draft.file.error);
              setEditing({ key: draft.key, answers: answersFromForm(draft.form), errors });
            }}
            editor={
              editing?.key === draft.key ? (
                <EvidenceFormView
                  labelledBy={`${formId}-${String(draft.key)}`}
                  answers={editing.answers}
                  onChange={(answers) => {
                    setEditing({ ...editing, answers });
                  }}
                  errors={editing.errors}
                  skills={content.data === undefined ? [] : skillChoices(content.data, service.records())}
                  onSubmit={() => {
                    const read = evidenceFormFrom(editing.answers);
                    if ("errors" in read) {
                      setEditing({ ...editing, errors: read.errors });
                      return;
                    }
                    const next = redraft(draft, read.form, keepOriginal);
                    if (!next.file.ok) {
                      setEditing({ ...editing, errors: fieldErrorsOf(next.file.error) });
                      return;
                    }
                    // Only a draft left out for a field to fix is put back; one the person left out stays out, and
                    // one that now looks like other evidence is left out (S15.4).
                    const earlier = drafts.filter((one) => one.key < draft.key);
                    const similar = likeness(service, read.form, earlier);
                    const include =
                      similar !== undefined && draft.similar === undefined
                        ? false
                        : draft.file.ok
                          ? draft.include
                          : true;
                    setDrafts((all) =>
                      all.map((one) => (one.key === draft.key ? { ...next, similar, include } : one)),
                    );
                    setEditing(undefined);
                  }}
                >
                  <div className="flex flex-wrap gap-(--space-2)">
                    <Button type="submit" variant="primary">
                      {t("paste.review.useAnswers")}
                    </Button>
                    <Button
                      onClick={() => {
                        setEditing(undefined);
                      }}
                    >
                      {t("paste.review.cancel")}
                    </Button>
                  </div>
                </EvidenceFormView>
              ) : undefined
            }
            editorId={`${formId}-${String(draft.key)}`}
          />
        ))}
        <div className="grid gap-(--space-1)">
          <label className="flex items-center gap-(--space-2)">
            <input
              type="checkbox"
              checked={keepOriginal}
              disabled={saving}
              aria-describedby={`${formId}-keep`}
              onChange={(event) => {
                const keep = event.currentTarget.checked;
                setKeepOriginal(keep);
                setDrafts((all) => all.map((one) => redraft(one, one.form, keep)));
              }}
            />
            {t("paste.review.keep")}
          </label>
          <p id={`${formId}-keep`} className="text-meta text-ink-2">
            {t("paste.review.keepHint")}
          </p>
        </div>
        {editing === undefined ? null : (
          <p id={`${formId}-editing`} className="text-ink-2">
            {t("paste.review.editFirst")}
          </p>
        )}
        {saveFailed === undefined ? null : (
          <Notice tone="problem" title={t("paste.review.saveFailed", saveFailed)} />
        )}
        <div className="flex flex-wrap gap-(--space-2)">
          <Button
            variant="primary"
            disabled={saving || editing !== undefined || included.length === 0}
            aria-describedby={editing === undefined ? undefined : `${formId}-editing`}
            onClick={() => void save()}
          >
            {t("paste.review.save", { count: included.length })}
          </Button>
          <Button disabled={saving} onClick={onAgain}>
            {t("paste.review.again")}
          </Button>
        </div>
      </div>
    </>
  );
}

function DraftCard({
  draft,
  model,
  editable,
  saving,
  onInclude,
  onEdit,
  editor,
  editorId,
}: {
  readonly draft: Draft;
  readonly model: string;
  readonly editable: boolean;
  readonly saving: boolean;
  readonly onInclude: (include: boolean) => void;
  readonly onEdit: () => void;
  readonly editor: ReactElement | undefined;
  readonly editorId: string;
}): ReactElement {
  const { t } = useTranslation();
  const { form, file, similar } = draft;
  const box = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const wasEditing = useRef(false);
  // Focus moves into the form when it opens, and back to the record when it closes.
  useEffect(() => {
    const editing = editor !== undefined;
    if (editing && !wasEditing.current)
      box.current?.querySelector<HTMLElement>("input, textarea, select")?.focus();
    if (!editing && wasEditing.current) heading.current?.focus();
    wasEditing.current = editing;
  }, [editor]);
  return (
    <article
      ref={box}
      aria-labelledby={editorId}
      className="grid gap-(--space-3) rounded-lg border border-line bg-surface p-(--pad)"
    >
      <div className="grid gap-(--space-1)">
        <h2 id={editorId} ref={heading} tabIndex={-1} className="text-section font-bold">
          {form.title}
        </h2>
        <p className="text-ink-2">
          {[kindName(t, form.kind), form.organisation].filter(Boolean).join(" · ")}
        </p>
        <p className="flex flex-wrap items-center gap-(--space-1) text-meta text-ink-2">
          <AiMark />
          <span className="font-semibold">{t("paste.review.label")}</span>
          <span>{t("paste.review.by", { model })}</span>
        </p>
      </div>
      {similar === undefined ? null : (
        <Notice
          tone="attention"
          title={t(similar.found === "profile" ? "paste.review.similar" : "paste.review.twin", {
            title: similar.title,
          })}
        />
      )}
      {file.ok ? null : <Notice tone="attention" title={t("paste.review.needsFix")} />}
      {editor ?? (file.ok ? <RecordFileView file={file.value} namedBy={editorId} /> : null)}
      {editor === undefined ? (
        <div className="flex flex-wrap items-center gap-(--space-3)">
          <label className="flex items-center gap-(--space-2)">
            <input
              type="checkbox"
              checked={draft.include && file.ok}
              disabled={!file.ok || saving}
              onChange={(event) => {
                onInclude(event.currentTarget.checked);
              }}
            />
            {t("paste.review.include")}
          </label>
          <Button size="sm" disabled={!editable} onClick={onEdit}>
            {t("paste.review.edit")}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
