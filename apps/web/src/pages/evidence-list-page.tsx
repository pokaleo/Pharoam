/**
 * The list of the person's evidence.
 *
 * @packageDocumentation
 */
import type { CoreService } from "@pharoam/core";
import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { buttonClassName } from "../ui/button.tsx";
import { PageTitle } from "../ui/page-title.tsx";

/**
 * Lists every piece of evidence, each opening its own page, with the way to add more.
 *
 * @remarks After a deletion, says what was deleted (MVP S5.2).
 * @param props - The open profile's service.
 * @returns The title, the add button and the list, or what to start with when there is none.
 */
export function EvidenceListPage({ service }: { readonly service: CoreService }): ReactElement {
  const { t } = useTranslation();
  const deleted = useRouterState({ select: (state) => state.location.state.deleted });
  const evidence = service
    .records()
    .flatMap((loaded) => (loaded.record.schema === "evidence/1" ? [loaded.record] : []));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-(--space-3)">
        <PageTitle title={t("evidence.title")} lead={t("evidence.lead", { count: evidence.length })} />
        <Link to="/evidence/new" className={`${buttonClassName("primary")} mb-(--space-5)`}>
          {t("evidence.add")}
        </Link>
      </div>
      <div className="grid max-w-[72ch] gap-(--space-4)">
        <p role="status" className="text-ink-2 empty:hidden">
          {deleted === undefined ? "" : t("evidence.deleted", { title: deleted })}
        </p>
        {evidence.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong p-(--pad) text-ink-2">
            {t("evidence.empty")}
          </p>
        ) : (
          <ul
            aria-label={t("evidence.list")}
            className="grid divide-y divide-line-soft rounded-lg bg-surface"
          >
            {evidence.map((record) => (
              <li key={record.id} className="grid gap-0.5 px-(--pad) py-(--space-3)">
                <Link
                  to="/evidence/$id"
                  params={{ id: record.id }}
                  className="font-semibold text-ink underline-offset-[0.18em] hover:underline"
                >
                  {record.title}
                </Link>
                <span className="text-meta text-ink-2">
                  {[kindName(t, record.kind), record.organisation]
                    .filter((part) => part !== undefined)
                    .join(" · ")}
                </span>
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
