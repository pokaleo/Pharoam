/**
 * The evidence scan: pick evidence or skills, see what will be sent, send, and follow its progress (MVP S16).
 *
 * @packageDocumentation
 */
import type { CoreService, ScanCall, SessionRecord } from "@pharoam/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { setAsideReason } from "../ai/problems.ts";
import type { ModelSetup } from "../ai/providers.ts";
import { useSession } from "../profile/session.tsx";
import { skillChoices, skillName } from "../profile/skills.ts";
import { Button, buttonClassName } from "../ui/button.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";

/** What a scan suggests: skill links for evidence records, or levels for skills. */
export type ScanKind = "links" | "levels";

type Step =
  | { readonly step: "confirm" }
  | { readonly step: "running"; readonly done: number; readonly total: number }
  | { readonly step: "done"; readonly session: SessionRecord; readonly stopped: boolean }
  | { readonly step: "failed"; readonly reason: string };

/**
 * The scan page: what to read, then what will be sent, then the scan's progress and what it found.
 *
 * @remarks Nothing is sent until the person has seen every call and its size and confirmed them all (MVP S16.1,
 * PRD D4). Suggestions go to a review session; nothing is linked or recorded here (S16.4). The scan shows its
 * progress and can be stopped between calls, keeping what finished; leaving the page stops it too (S16.5). Without
 * a model, it offers to set one up (S13.8).
 * @param props - The open profile's service, the kind of scan, and the one record or skill to start from, if any.
 * @returns The page for the current step.
 */
export function ScanPage({
  service,
  kind,
  only,
}: {
  readonly service: CoreService;
  readonly kind: ScanKind;
  readonly only?: string | undefined;
}): ReactElement {
  const { t } = useTranslation();
  const { model } = useSession();
  const [calls, setCalls] = useState<readonly ScanCall[]>();
  const title = t(kind === "links" ? "scan.linksTitle" : "scan.levelsTitle");
  const lead = t(kind === "links" ? "scan.linksLead" : "scan.levelsLead");

  if (model === undefined) {
    return (
      <>
        <PageTitle title={title} lead={lead} />
        <Notice tone="info" title={t("scan.noModel")}>
          <Link to="/settings" className="text-channel underline">
            {t("scan.setUp")}
          </Link>
        </Notice>
      </>
    );
  }

  return calls === undefined ? (
    <Choose service={service} kind={kind} only={only} title={title} lead={lead} onContinue={setCalls} />
  ) : (
    <Run
      service={service}
      kind={kind}
      setup={model}
      calls={calls}
      onBack={() => {
        setCalls(undefined);
      }}
    />
  );
}

function Choose({
  service,
  kind,
  only,
  title,
  lead,
  onContinue,
}: {
  readonly service: CoreService;
  readonly kind: ScanKind;
  readonly only: string | undefined;
  readonly title: string;
  readonly lead: string;
  readonly onContinue: (calls: readonly ScanCall[]) => void;
}): ReactElement {
  const { t } = useTranslation();
  const { services } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  const groupId = useId();
  const skills = content.data === undefined ? [] : skillChoices(content.data, service.records());
  const options =
    kind === "links"
      ? service
          .records()
          .flatMap(({ record }) =>
            record.schema === "evidence/1" && record.kind !== "assessment"
              ? [{ id: record.id, label: record.title }]
              : [],
          )
      : service.judgeableSkills().map((slug) => ({ id: slug, label: skillName(skills, slug) }));
  const offered = only === undefined ? options : options.filter((option) => option.id === only);
  const [picked, setPicked] = useState<ReadonlySet<string>>(
    () => new Set(offered.map((option) => option.id)),
  );
  const [error, setError] = useState(false);

  return (
    <>
      <PageTitle title={title} lead={lead} />
      {offered.length === 0 ? (
        <p className="text-ink-2">{t(kind === "links" ? "scan.noEvidence" : "scan.noSkills")}</p>
      ) : (
        <form
          noValidate
          className="grid max-w-[880px] gap-(--space-4)"
          onSubmit={(event) => {
            event.preventDefault();
            const ids = offered.map((option) => option.id).filter((id) => picked.has(id));
            if (ids.length === 0) {
              setError(true);
              return;
            }
            onContinue(kind === "links" ? service.linkScan(ids) : service.levelScan(ids));
          }}
        >
          <fieldset
            aria-describedby={error ? `${groupId}-error` : undefined}
            className="grid gap-(--space-2) rounded-lg border border-line bg-surface p-(--pad)"
          >
            <legend className="px-1 font-semibold">
              {t(kind === "links" ? "scan.evidenceGroup" : "scan.skillsGroup")}
            </legend>
            {offered.map((option) => (
              <label key={option.id} className="flex items-center gap-(--space-2)">
                <input
                  type="checkbox"
                  checked={picked.has(option.id)}
                  onChange={(event) => {
                    const next = new Set(picked);
                    if (event.currentTarget.checked) next.add(option.id);
                    else next.delete(option.id);
                    setPicked(next);
                    setError(false);
                  }}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          {error ? (
            <p id={`${groupId}-error`} className="text-problem">
              {t("scan.pickOne")}
            </p>
          ) : null}
          <div>
            <Button type="submit" variant="primary">
              {t("scan.continue")}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}

// Each call's label, as the person knows what it reads: the evidence record's title, or the skill's name.
function useCallLabel(service: CoreService): (call: ScanCall) => string {
  const { services } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  const skills = content.data === undefined ? [] : skillChoices(content.data, service.records());
  return (call) => {
    if (call.kind === "skill-levels") return skillName(skills, call.skill);
    const found = service.find(call.evidence);
    return found?.record.schema === "evidence/1" ? found.record.title : call.evidence;
  };
}

function Run({
  service,
  kind,
  setup,
  calls,
  onBack,
}: {
  readonly service: CoreService;
  readonly kind: ScanKind;
  readonly setup: ModelSetup;
  readonly calls: readonly ScanCall[];
  readonly onBack: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const { services, changed, logCall } = useSession();
  const label = useCallLabel(service);
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const stop = useRef(false);
  const [step, setStep] = useState<Step>({ step: "confirm" });
  const [stopping, setStopping] = useState(false);
  const provider = t(`settings.model.names.${setup.choice.kind}`);
  const number = new Intl.NumberFormat(t("app.locale"));
  const size = calls.reduce((total, call) => total + call.call.size, 0);
  // Each step replaces the last in place, so focus moves to the title rather than being lost with its buttons.
  useEffect(() => {
    heading.current?.focus();
  }, [step.step]);
  // Leaving the page stops a running scan, keeping what finished (MVP S16.5).
  useEffect(() => {
    // Mounting again, as StrictMode does after a rehearsal, means the page is here: the scan isn't stopped.
    stop.current = false;
    return () => {
      stop.current = true;
    };
  }, []);

  const send = async (): Promise<void> => {
    setStep({ step: "running", done: 0, total: calls.length });
    let loaded;
    try {
      loaded = await services.providers(setup.choice);
    } catch {
      setStep({ step: "failed", reason: t("scan.loadFailed", { provider }) });
      return;
    }
    let ran;
    let finished = 0;
    try {
      ran = await service.runScan(calls, loaded, {
        model: setup.model,
        now: () => new Date(),
        onProgress: (done, total) => {
          finished = done;
          if (!stop.current) setStep({ step: "running", done, total });
        },
        stopped: () => stop.current,
        onCall: (call) => {
          logCall(call);
        },
      });
    } catch {
      // Something broke mid-scan, such as the provider's code: the session keeps what finished.
      changed();
      setStep({ step: "failed", reason: t("scan.broke") });
      return;
    }
    changed();
    if (!ran.ok) {
      setStep({ step: "failed", reason: t("scan.failed", { reason: ran.error.kind }) });
      return;
    }
    const { record } = ran.value;
    if (record.schema !== "session/1") {
      setStep({ step: "failed", reason: t("scan.broke") });
      return;
    }
    setStep({ step: "done", session: record, stopped: finished < calls.length });
  };

  const title = t(kind === "links" ? "scan.linksTitle" : "scan.levelsTitle");
  if (step.step === "done" || step.step === "failed" || step.step === "running") {
    return (
      <>
        <PageTitle title={title} lead={t("scan.send.lead", { provider })} titleRef={heading} />
        <div className="grid max-w-[880px] gap-(--space-4)">
          <p role="status" className="empty:sr-only">
            {step.step === "running"
              ? t("scan.progress", { done: step.done, total: step.total })
              : step.step === "done"
                ? t(step.stopped ? "scan.stopped" : "scan.done")
                : ""}
          </p>
          {step.step === "running" ? (
            <div className="grid gap-(--space-2)">
              <p className="text-meta text-ink-2">{t("scan.leaving")}</p>
              <div>
                <Button
                  disabled={stopping}
                  onClick={() => {
                    stop.current = true;
                    setStopping(true);
                  }}
                >
                  {stopping ? t("scan.stopping") : t("scan.stop")}
                </Button>
              </div>
            </div>
          ) : null}
          {step.step === "failed" ? (
            <>
              <Notice tone="problem" title={step.reason} />
              <div>
                <Link to="/review" className={buttonClassName("secondary")}>
                  {t("scan.review")}
                </Link>
              </div>
            </>
          ) : null}
          {step.step === "done" ? <Findings service={service} session={step.session} /> : null}
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title={title} lead={t("scan.send.lead", { provider })} titleRef={heading} />
      <div className="grid max-w-[880px] gap-(--space-4)">
        <section
          aria-labelledby={titleId}
          className="grid gap-(--space-3) rounded-lg border border-line bg-surface p-(--pad)"
        >
          <h2 id={titleId} className="text-section font-bold">
            {t("scan.send.title")}
          </h2>
          <p>
            {t(kind === "links" ? "scan.send.linkCalls" : "scan.send.levelCalls", { count: calls.length })}
          </p>
          <ul className="grid divide-y divide-line">
            {calls.map((call) => (
              <li
                key={call.kind === "skill-links" ? call.evidence : call.skill}
                className="grid gap-1 py-(--space-2)"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-(--space-2)">
                  <span className="font-semibold">{label(call)}</span>
                  <span className="text-meta text-ink-2">
                    {t("scan.send.callSize", { size: number.format(call.call.size) })}
                  </span>
                </div>
                <details>
                  <summary className="cursor-pointer text-meta text-channel">{t("scan.send.show")}</summary>
                  <pre className="mt-1 rounded-md bg-panel px-3 py-2 font-mono text-[13px] break-words whitespace-pre-wrap">
                    {call.call.parts.map((part) => part.text).join("\n\n")}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
          <p className="text-ink-2">{t("scan.send.size", { size: number.format(size) })}</p>
          <p className="text-ink-2">{t("scan.send.model", { model: setup.name ?? setup.model, provider })}</p>
        </section>
        <div className="flex flex-wrap gap-(--space-2)">
          <Button variant="primary" onClick={() => void send()}>
            {t("scan.send.send", { count: calls.length })}
          </Button>
          <Button onClick={onBack}>{t("scan.send.back")}</Button>
        </div>
      </div>
    </>
  );
}

// What a finished or stopped scan found: suggestions waiting, those that would change nothing, and what was set aside.
function Findings({
  service,
  session,
}: {
  readonly service: CoreService;
  readonly session: SessionRecord;
}): ReactElement {
  const { t } = useTranslation();
  const { services } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  const skills = content.data === undefined ? [] : skillChoices(content.data, service.records());
  const waiting = session.suggestions.filter((suggestion) => suggestion.decision === undefined).length;
  const name = (aside: SessionRecord["set_aside"][number]): string => {
    if (aside.skill !== undefined) return skillName(skills, aside.skill);
    const found = aside.evidence === undefined ? undefined : service.find(aside.evidence);
    return found?.record.schema === "evidence/1" ? found.record.title : (aside.evidence ?? "");
  };
  return (
    <div className="grid gap-(--space-2)">
      <p>{t("scan.waiting", { count: waiting })}</p>
      {session.already.length === 0 ? null : (
        <p className="text-ink-2">{t("scan.already", { count: session.already.length })}</p>
      )}
      {session.set_aside.map((aside) => (
        <p key={`${aside.evidence ?? ""}${aside.skill ?? ""}`} className="text-ink-2">
          {t("scan.setAside", { name: name(aside), reason: setAsideReason(t, aside.reason) })}
        </p>
      ))}
      {waiting === 0 ? null : (
        <div>
          <Link to="/review" className={buttonClassName("primary")}>
            {t("scan.review")}
          </Link>
        </div>
      )}
    </div>
  );
}
