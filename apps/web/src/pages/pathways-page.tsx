/**
 * The pathways in the content pack (MVP S10.1).
 *
 * @packageDocumentation
 */
import { pathwaySummaries } from "@pharoam/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../profile/session.tsx";
import { PageTitle } from "../ui/page-title.tsx";

/**
 * Lists every pathway with its summary, each opening its own page.
 *
 * @remarks In the pack's order, never ranked or matched to the person (Charter R1, R2); one drafted with AI is
 * marked so (MVP S10.3).
 * @returns The title and the list of pathways.
 */
export function PathwaysPage(): ReactElement {
  const { t } = useTranslation();
  const { services } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  const pathways = content.data === undefined ? [] : pathwaySummaries(content.data);

  return (
    <>
      <PageTitle title={t("pathways.title")} lead={t("pathways.lead")} />
      <ul aria-label={t("pathways.list")} className="grid max-w-[72ch] gap-(--space-3)">
        {pathways.map((pathway) => (
          <li key={pathway.slug} className="grid gap-(--space-1) rounded-lg bg-surface p-(--pad)">
            <Link
              to="/pathways/$slug"
              params={{ slug: pathway.slug }}
              className="text-section font-bold text-ink underline-offset-[0.18em] hover:underline"
            >
              {pathway.title}
            </Link>
            <p className="text-ink-2">{pathway.summary}</p>
            {pathway.ai === null ? null : (
              <p className="text-meta">
                <span className="rounded-sm border border-dashed border-(--ai-edge) px-1.5 text-ink-2">
                  {t("pathways.aiMark")}
                </span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
