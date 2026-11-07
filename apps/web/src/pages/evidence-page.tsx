/**
 * One piece of evidence, with its files, editing and deleting (MVP S4.5, S5, S14).
 *
 * @packageDocumentation
 */
import type { AttachmentView, CoreService } from "@pharoam/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { answersOf } from "../evidence/answers.ts";
import { EvidenceFiles, useAttachments } from "../evidence/evidence-files.tsx";
import { useSession } from "../profile/session.tsx";
import { skillChoices, skillName } from "../profile/skills.ts";
import { AiMark } from "../ui/ai-mark.tsx";
import { Button, buttonClassName } from "../ui/button.tsx";
import { Icon } from "../ui/icon.tsx";
import { Markdown } from "../ui/markdown.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";
import { Tag } from "../ui/tag.tsx";
import { kindName } from "./evidence-list-page.tsx";

/**
 * Shows a piece of evidence: its fields, its links as links, its skills by name, and what the person did, rendered
 * safely (MVP S4.5).
 *
 * @remarks Deleting asks first and names the levels that cite the evidence (MVP S5.3); those levels are never
 * changed, and show the evidence as removed afterwards (MVP S5.2, hard rule 4). It also shows the evidence's files,
 * which are kept unless the person asks for them to be deleted too (MVP S14.4).
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
  const files = useAttachments(service, loaded);

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
        crumbs={[
          <Link key="evidence" to="/evidence">
            {t("evidence.title")}
          </Link>,
        ]}
        crumbsLabel={t("app.crumbs")}
        actions={
          <>
            {record.kind === "assessment" ? null : (
              <Link to="/scan" search={{ kind: "links", only: id }} className={buttonClassName("secondary")}>
                <AiMark />
                {t("evidence.suggest")}
              </Link>
            )}
            {editable ? (
              <Link to="/evidence/$id/edit" params={{ id }} className={buttonClassName("secondary")}>
                <Icon of={Pencil} />
                {t("evidence.page.edit")}
              </Link>
            ) : null}
            <Button
              variant="problem"
              onClick={() => {
                setDeleting(true);
              }}
            >
              <Icon of={Trash2} />
              {t("evidence.page.delete")}
            </Button>
          </>
        }
      />
      <div className="grid items-start gap-(--gap) lg:grid-cols-[minmax(0,1fr)_360px]">
        {deleting ? (
          <DeleteConfirmation
            service={service}
            location={loaded.location}
            title={record.title}
            skills={service.evidenceReferences(id).map((reference) => skillName(skills, reference.skill))}
            files={
              files === false || files === undefined
                ? files
                : files.filter((file) => file.stored !== undefined)
            }
            onKeep={() => {
              setDeleting(false);
            }}
          />
        ) : null}
        <dl className="grid grid-cols-[max-content_1fr] gap-x-(--space-4) gap-y-1.5 rounded-lg bg-panel p-(--pad) lg:order-2">
          <Detail label={t("evidence.page.when")}>{when === "" ? null : when}</Detail>
          <Detail label={t("evidence.page.links")}>
            {record.links.length === 0 ? null : (
              <ul className="grid gap-1">
                {record.links.map((link) => (
                  <li key={link}>
                    <a href={link} target="_blank" rel="noopener noreferrer" className="break-all">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Detail>
          <Detail label={t("evidence.page.skills")}>
            {record.skills.length === 0 ? null : (
              <ul className="flex flex-wrap gap-1">
                {record.skills.map((slug) => (
                  <li key={slug}>
                    <Tag tone="skill">{skillName(skills, slug)}</Tag>
                  </li>
                ))}
              </ul>
            )}
          </Detail>
          <Detail label={t("evidence.page.file")}>
            <code className="font-mono text-[12px] break-all">{loaded.location}</code>
          </Detail>
        </dl>
        <div className="grid min-w-0 gap-(--gap)">
          {editable ? null : <Notice tone="info" title={t("evidence.page.notEditable")} />}
          {loaded.file.body.trim() === "" ? null : (
            <section
              aria-label={t("evidence.page.description")}
              className="rounded-lg border border-line bg-surface p-(--pad)"
            >
              <Markdown text={loaded.file.body} />
            </section>
          )}
          <EvidenceFiles
            service={service}
            loaded={loaded}
            files={files}
            editable={record.kind !== "assessment"}
          />
        </div>
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
      <dt className="text-ink-2">{label}</dt>
      <dd className="m-0 min-w-0">{children}</dd>
    </>
  );
}

function DeleteConfirmation({
  service,
  location,
  title,
  skills,
  files,
  onKeep,
}: {
  readonly service: CoreService;
  readonly location: string;
  readonly title: string;
  readonly skills: readonly string[];
  /** The evidence's stored files; `undefined` while they are read, `false` when they couldn't be. */
  readonly files: readonly AttachmentView[] | false | undefined;
  readonly onKeep: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  const textId = useId();
  const navigate = useNavigate();
  const { changed } = useSession();
  const box = useRef<HTMLDivElement>(null);
  const [withFiles, setWithFiles] = useState(false);
  const cited = [...new Set(skills)];
  const list = new Intl.ListFormat(t("app.locale"), { type: "conjunction" });
  const remove = useMutation({
    mutationFn: async () => {
      const chosen = withFiles && files !== false && files !== undefined ? files : [];
      const deleted = await service.deleteEvidence(location, chosen);
      changed();
      if (deleted.ok)
        await navigate({ to: "/evidence", state: { deleted: title, keptFiles: [...deleted.value.kept] } });
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
      className="grid gap-(--space-3) rounded-lg border border-problem-edge bg-problem-wash p-(--pad) lg:col-span-2"
    >
      <h2 id={titleId} className="text-section font-bold">
        {t("evidence.delete.title", { title })}
      </h2>
      <div id={textId} className="grid gap-(--space-1) text-ink-2">
        <p>{t("evidence.delete.text", { file: location })}</p>
        {cited.length === 0 ? null : (
          <p>{t("evidence.delete.cited", { count: cited.length, skills: list.format(cited) })}</p>
        )}
        {files === false ? <p>{t("evidence.delete.filesUnknown")}</p> : null}
        {files === false || files === undefined || files.length === 0 ? null : (
          <>
            <p>{t("evidence.delete.files")}</p>
            <ul className="list-disc ps-(--space-4)">
              {files.map((file) => (
                <li key={file.name} className="break-all">
                  {file.name}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {files === false || files === undefined || files.length === 0 ? null : (
        <label className="flex items-center gap-(--space-2)">
          <input
            type="checkbox"
            checked={withFiles}
            onChange={(event) => {
              setWithFiles(event.currentTarget.checked);
            }}
          />
          {t("evidence.delete.alsoFiles")}
        </label>
      )}
      {remove.data === false || remove.isError ? (
        <Notice tone="problem" title={t("evidence.delete.failed")} />
      ) : null}
      <div className="flex flex-wrap gap-(--space-2)">
        <Button
          variant="primary"
          // Not before the files are known, so the person is always asked about them (MVP S14.4).
          disabled={remove.isPending || files === undefined}
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
