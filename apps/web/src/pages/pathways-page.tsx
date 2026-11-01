/**
 * The pathways in the content pack (MVP S10.1).
 *
 * @packageDocumentation
 */
import { pathwaySummaries } from "@pharoam/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Compass } from "lucide-react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../profile/session.tsx";
import { AiMark } from "../ui/ai-mark.tsx";
import { Icon } from "../ui/icon.tsx";
import { PageTitle } from "../ui/page-title.tsx";
import { Tag } from "../ui/tag.tsx";

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
      <ul
        aria-label={t("pathways.list")}
        className="rounded-lg border border-line bg-surface px-(--pad) py-1"
      >
        {pathways.map((pathway) => (
          <li
            key={pathway.slug}
            className="flex min-h-(--row-2) items-center gap-(--space-3) border-b border-line-soft py-3 last:border-b-0"
          >
            <Icon of={Compass} className="self-start text-ink-2 max-sm:hidden sm:mt-0.5" />
            <span className="grid min-w-0 flex-1 gap-1">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link
                  to="/pathways/$slug"
                  params={{ slug: pathway.slug }}
                  className="font-semibold text-ink no-underline hover:underline"
                >
                  {pathway.title}
                </Link>
                {pathway.ai === null ? null : (
                  <Tag tone="ai-judged" mark={<AiMark />}>
                    {t("pathways.aiMark")}
                  </Tag>
                )}
              </span>
              <span className="max-w-[72ch] text-ink-2">{pathway.summary}</span>
            </span>
            <Icon of={ChevronRight} className="text-ink-3 rtl:-scale-x-100" />
          </li>
        ))}
      </ul>
    </>
  );
}
