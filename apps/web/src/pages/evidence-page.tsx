/**
 * One piece of evidence, with editing and deleting (MVP S4.5, S5).
 *
 * @packageDocumentation
 */
import type { CoreService } from "@pharoam/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { answersOf } from "../evidence/answers.ts";
import { useSession } from "../profile/session.tsx";
import { skillChoices, skillName } from "../profile/skills.ts";
import { Button, buttonClassName } from "../ui/button.tsx";
import { Markdown } from "../ui/markdown.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";
import { kindName } from "./evidence-list-page.tsx";

/**
 * Shows a piece of evidence: its fields, its links as links, its skills by name, and what the person did, rendered
 * safely (MVP S4.5).
 *
 * @remarks Deleting asks first and names the levels that cite the evidence (MVP S5.3); those levels are never
 * changed, and show the evidence as removed afterwards (MVP S5.2, hard rule 4).
 * @param props - The open profile's service and the evidence's ID.
 * @returns The evidence's page, or a note when there is no evidence with that ID.
 */
export function EvidencePage({
  service,
  id,
}: {
  readonly service: CoreService;
  readonly id: string;
}): ReactElement {
  const { t } = useTranslation();
  const { services } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  const [deleting, setDeleting] = useState(false);
  const loaded = service.find(id);

  if (loaded?.record.schema !== "evidence/1") {
    return (
      <>
        <PageTitle title={t("evidence.title")} lead={t("evidence.page.missing")} />
        <Link to="/evidence" className="text-channel underline">
          {t("evidence.page.back")}
        </Link>
      </>
    );
  }
  const { record } = loaded;
  const skills = content.data === undefined ? [] : skillChoices(content.data, service.records());
  const when = record.date ?? [record.start, record.end].filter((part) => part !== undefined).join(" – ");
  const editable = answersOf(loaded.file) !== undefined;

  return (
    <>
      <PageTitle
        title={record.title}
        lead={[kindName(t, record.kind), record.organisation].filter(Boolean).join(" · ")}
      />
      <div className="grid max-w-[72ch] gap-(--space-5)">
        <div className="flex flex-wrap gap-(--space-2)">
          {editable ? (
            <Link to="/evidence/$id/edit" params={{ id }} className={buttonClassName("secondary")}>
              {t("evidence.page.edit")}
            </Link>
          ) : null}
          <Button
            onClick={() => {
              setDeleting(true);
            }}
          >
            {t("evidence.page.delete")}
          </Button>
        </div>
        {deleting ? (
          <DeleteConfirmation
            service={service}
            location={loaded.location}
            title={record.title}
            skills={service.evidenceReferences(id).map((reference) => skillName(skills, reference.skill))}
            onKeep={() => {
              setDeleting(false);
            }}
          />
        ) : null}
        {editable ? null : <p className="text-ink-2">{t("evidence.page.notEditable")}</p>}
        <dl className="grid gap-(--space-3) sm:grid-cols-[10rem_1fr]">
          <Detail label={t("evidence.page.when")}>{when === "" ? null : when}</Detail>
          <Detail label={t("evidence.page.links")}>
            {record.links.length === 0 ? null : (
              <ul className="grid gap-1">
                {record.links.map((link) => (
                  <li key={link}>
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-channel underline"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Detail>
          <Detail label={t("evidence.page.skills")}>
            {record.skills.length === 0 ? null : (
              <ul className="flex flex-wrap gap-(--space-2)">
                {record.skills.map((slug) => (
                  <li key={slug} className="rounded-sm bg-panel px-2 text-meta">
                    {skillName(skills, slug)}
                  </li>
                ))}
              </ul>
            )}
          </Detail>
          <Detail label={t("evidence.page.file")}>
            <code className="font-mono text-meta">{loaded.location}</code>
          </Detail>
        </dl>
        {loaded.file.body.trim() === "" ? null : (
          <section aria-label={t("evidence.page.description")}>
            <Markdown text={loaded.file.body} />
          </section>
        )}
      </div>
    </>
  );
}

// One row of the evidence's details, left out when there is nothing to show.
function Detail({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): ReactElement | null {
  if (children === null) return null;
  return (
    <>
      <dt className="font-semibold">{label}</dt>
      <dd className="m-0">{children}</dd>
    </>
  );
}

function DeleteConfirmation({
  service,
  location,
  title,
  skills,
  onKeep,
}: {
  readonly service: CoreService;
  readonly location: string;
  readonly title: string;
  readonly skills: readonly string[];
  readonly onKeep: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  const textId = useId();
  const navigate = useNavigate();
  const { changed } = useSession();
  const box = useRef<HTMLDivElement>(null);
  const cited = [...new Set(skills)];
  const list = new Intl.ListFormat(t("app.locale"), { type: "conjunction" });
  const remove = useMutation({
    mutationFn: async () => {
      const deleted = await service.deleteEvidence(location);
      changed();
      if (deleted.ok) await navigate({ to: "/evidence", state: { deleted: title } });
      return deleted.ok;
    },
  });
  // The question appears in place, so focus moves to it.
  useEffect(() => {
    box.current?.focus();
  }, []);

  return (
    <div
      ref={box}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={textId}
      tabIndex={-1}
      className="grid gap-(--space-3) rounded-lg border border-problem-edge bg-problem-wash p-(--pad)"
    >
      <h2 id={titleId} className="text-section font-bold">
        {t("evidence.delete.title", { title })}
      </h2>
      <div id={textId} className="grid gap-(--space-1) text-ink-2">
        <p>{t("evidence.delete.text", { file: location })}</p>
        {cited.length === 0 ? null : (
          <p>{t("evidence.delete.cited", { count: cited.length, skills: list.format(cited) })}</p>
        )}
      </div>
      {remove.data === false || remove.isError ? (
        <Notice tone="problem" title={t("evidence.delete.failed")} />
      ) : null}
      <div className="flex flex-wrap gap-(--space-2)">
        <Button
          variant="primary"
          disabled={remove.isPending}
          onClick={() => {
            remove.mutate();
          }}
        >
          {t("evidence.delete.confirm")}
        </Button>
        <Button onClick={onKeep}>{t("evidence.delete.keep")}</Button>
      </div>
    </div>
  );
}
