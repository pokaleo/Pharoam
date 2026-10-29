/**
 * One pathway in full (MVP S10.2, S10.3).
 *
 * @packageDocumentation
 */
import { pathwayDetail } from "@pharoam/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../profile/session.tsx";
import { dayName } from "../skills/labels.ts";
import { buttonClassName } from "../ui/button.tsx";
import { PageTitle } from "../ui/page-title.tsx";

/**
 * Shows what a pathway asks for: each requirement with its skill, level, importance and sources, and who reviewed it.
 *
 * @remarks A pathway drafted with AI says so, with the model, beside who reviewed it (MVP S10.3, PRD D6, I3). Any
 * pathway's gap can be explored (Charter R2).
 * @param props - The pathway's slug.
 * @returns The pathway's page, or a note when the pack doesn't have it.
 */
export function PathwayPage({ slug }: { readonly slug: string }): ReactElement | null {
  const { t } = useTranslation();
  const { services } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  if (content.data === undefined) return null;
  const pathway = pathwayDetail(content.data, slug);
  if (pathway === undefined) {
    return (
      <>
        <PageTitle title={t("pathways.title")} lead={t("pathways.missing")} />
        <Link to="/pathways" className="text-channel underline">
          {t("pathways.back")}
        </Link>
      </>
    );
  }
  const reviewed = { by: pathway.review.by, date: dayName(t, pathway.review.at) };

  return (
    <>
      <PageTitle title={pathway.title} lead={pathway.summary} />
      <div className="grid max-w-(--canvas-max) gap-(--space-5)">
        <div className="grid max-w-[72ch] gap-(--space-2)">
          {pathway.ai === null ? (
            <p className="text-ink-2">{t("pathways.reviewed", reviewed)}</p>
          ) : (
            <>
              <p className="rounded-lg border border-dashed border-(--ai-edge) p-(--pad) text-ink-2">
                {t("pathways.aiDrafted", { model: pathway.ai.model, by: pathway.review.by })}
              </p>
              <p className="text-ink-2">{t("pathways.reviewed", reviewed)}</p>
            </>
          )}
          <div>
            <Link to="/pathways/$slug/gap" params={{ slug }} className={buttonClassName("primary")}>
              {t("pathways.seeGap")}
            </Link>
          </div>
        </div>
        <section className="grid gap-(--space-3)">
          <h2 className="text-section font-bold">{t("pathways.requirements")}</h2>
          <div className="overflow-x-auto rounded-lg bg-surface p-(--pad)">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-line text-meta text-ink-2">
                  <th scope="col" className="py-2 pe-3 text-start font-semibold">
                    {t("pathways.columns.skill")}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-start font-semibold">
                    {t("pathways.columns.level")}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-start font-semibold">
                    {t("pathways.columns.importance")}
                  </th>
                  <th scope="col" className="py-2 text-start font-semibold">
                    {t("pathways.columns.sources")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pathway.requirements.map((requirement) => (
                  <tr key={requirement.skill} className="border-b border-line-soft align-top">
                    <th scope="row" className="py-(--space-2) pe-3 text-start font-semibold">
                      {requirement.name}
                    </th>
                    <td className="py-(--space-2) pe-3">
                      <span className="font-semibold">{requirement.levelName}</span>{" "}
                      <span className="text-ink-3">{requirement.level}</span>
                    </td>
                    <td className="py-(--space-2) pe-3">
                      {t(`pathways.importance.${requirement.importance}`)}
                    </td>
                    <td className="py-(--space-2) text-meta">
                      <ul className="grid gap-1">
                        {requirement.sources.map((source) => (
                          <li key={source.title}>
                            {source.url === undefined ? (
                              source.title
                            ) : (
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-channel underline"
                              >
                                {source.title}
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <TextList title={t("pathways.prerequisites")} items={pathway.prerequisites} />
        <TextList title={t("pathways.uncertainties")} items={pathway.uncertainties} />
      </div>
    </>
  );
}

function TextList({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly string[];
}): ReactElement | null {
  if (items.length === 0) return null;
  return (
    <section className="grid max-w-[72ch] gap-(--space-2)">
      <h2 className="text-section font-bold">{title}</h2>
      <ul className="grid list-disc gap-1 ps-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
