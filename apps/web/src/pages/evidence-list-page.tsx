/**
 * The list of the person's evidence.
 *
 * @packageDocumentation
 */
import type { CoreService } from "@pharoam/core";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { FileText, Paperclip } from "lucide-react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../profile/session.tsx";
import { skillChoices, skillName } from "../profile/skills.ts";
import { buttonClassName } from "../ui/button.tsx";
import { Empty } from "../ui/empty.tsx";
import { Icon } from "../ui/icon.tsx";
import { PageTitle } from "../ui/page-title.tsx";
import { Tag } from "../ui/tag.tsx";

/**
 * Lists every piece of evidence, each opening its own page, with the way to add more.
 *
 * @remarks After a deletion, says what was deleted, and any of its files kept (MVP S5.2, S14.4).
 * @param props - The open profile's service.
 * @returns The title, the add button and the list, or what to start with when there is none.
 */
export function EvidenceListPage({ service }: { readonly service: CoreService }): ReactElement {
  const { t } = useTranslation();
  const { services } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  const deleted = useRouterState({ select: (state) => state.location.state.deleted });
  const keptFiles = useRouterState({ select: (state) => state.location.state.keptFiles }) ?? [];
  const list = new Intl.ListFormat(t("app.locale"), { type: "conjunction" });
  const evidence = service
    .records()
    .flatMap((loaded) => (loaded.record.schema === "evidence/1" ? [loaded.record] : []));
  const skills = content.data === undefined ? [] : skillChoices(content.data, service.records());

  return (
    <>
      <PageTitle
        title={t("evidence.title")}
        lead={t("evidence.lead", { count: evidence.length })}
        actions={
          <Link to="/evidence/new" className={buttonClassName("primary")}>
            <Icon of={Paperclip} />
            {t("evidence.add")}
          </Link>
        }
      />
      <div className="grid gap-(--gap)">
        <p role="status" className="text-ink-2 empty:hidden">
          {deleted === undefined
            ? ""
            : [
                t("evidence.deleted", { title: deleted }),
                keptFiles.length === 0 ? "" : t("evidence.keptFiles", { files: list.format(keptFiles) }),
              ]
                .filter((part) => part !== "")
                .join(" ")}
        </p>
        {evidence.length === 0 ? (
          <Empty text={t("evidence.empty")} />
        ) : (
          <ul
            aria-label={t("evidence.list")}
            className="rounded-lg border border-line bg-surface px-(--pad) py-1"
          >
            {evidence.map((record) => (
              <li
                key={record.id}
                className="flex min-h-(--row-2) flex-wrap items-center gap-x-(--space-3) gap-y-1.5 border-b border-line-soft py-2 last:border-b-0"
              >
                <Icon of={FileText} className="text-ink-2" />
                <span className="min-w-0 flex-1">
                  <Link
                    to="/evidence/$id"
                    params={{ id: record.id }}
                    className="font-semibold text-ink no-underline hover:underline"
                  >
                    {record.title}
                  </Link>
                  <span className="mt-0.5 block text-meta text-ink-2">
                    {[kindName(t, record.kind), record.organisation]
                      .filter((part) => part !== undefined)
                      .join(" · ")}
                  </span>
                </span>
                {record.skills.length === 0 ? null : (
                  <span className="flex flex-wrap items-center gap-1 max-sm:ps-7">
                    <span className="sr-only">{t("evidence.page.skills")}</span>
                    {record.skills.map((slug) => (
                      <Tag key={slug} tone="skill">
                        {skillName(skills, slug)}
                      </Tag>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/**
 * The name of a kind of evidence, in the person's language.
 *
 * @param t - The translation function.
 * @param kind - The kind, as stored.
 * @returns Its name for the kinds the form offers, or the kind as stored for others, such as `degree`.
 */
export function kindName(t: ReturnType<typeof useTranslation>["t"], kind: string): string {
  switch (kind) {
    case "project":
    case "job":
    case "module":
    case "certificate":
    case "other":
      return t(`evidence.kinds.${kind}`);
    default:
      return kind;
  }
}
