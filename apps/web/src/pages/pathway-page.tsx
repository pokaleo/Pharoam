/**
 * One pathway in full (MVP S10.2, S10.3).
 *
 * @packageDocumentation
 */
import { pathwayDetail } from "@pharoam/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Circle, Diamond, Route } from "lucide-react";
import { useId, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { PathwayProvenance } from "../pathways/provenance.tsx";
import { useSession } from "../profile/session.tsx";
import { Level } from "../skills/level.tsx";
import { buttonClassName } from "../ui/button.tsx";
import { Icon } from "../ui/icon.tsx";
import { PageTitle } from "../ui/page-title.tsx";
import { TABLE } from "../ui/table.ts";
import { Tag } from "../ui/tag.tsx";

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
  const titleId = useId();
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
  // Two lists sit side by side on a wide screen; one alone takes the full width rather than half of it.
  const pair = pathway.prerequisites.length > 0 && pathway.uncertainties.length > 0;

  return (
    <>
      <PageTitle
        title={pathway.title}
        lead={pathway.summary}
        crumbs={[
          <Link key="pathways" to="/pathways">
            {t("pathways.title")}
          </Link>,
        ]}
        crumbsLabel={t("app.crumbs")}
        actions={
          <Link to="/pathways/$slug/gap" params={{ slug }} className={buttonClassName("primary")}>
            <Icon of={Route} />
            {t("pathways.seeGap")}
          </Link>
        }
      />
      <div className="grid gap-(--gap)">
        <PathwayProvenance pathway={pathway} />
        <section aria-labelledby={titleId} className="rounded-lg border border-line bg-surface p-(--pad)">
          <h2 id={titleId} className="mb-(--space-3) text-section font-bold tracking-[-0.01em]">
            {t("pathways.requirements")}
          </h2>
          <div className="overflow-x-auto">
            <table className={`${TABLE.table} min-w-[640px]`}>
              <thead>
                <tr>
                  <th scope="col" className={TABLE.head}>
                    {t("pathways.columns.skill")}
                  </th>
                  <th scope="col" className={TABLE.head}>
                    {t("pathways.columns.level")}
                  </th>
                  <th scope="col" className={TABLE.head}>
                    {t("pathways.columns.importance")}
                  </th>
                  <th scope="col" className={TABLE.head}>
                    {t("pathways.columns.sources")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pathway.requirements.map((requirement) => (
                  <tr key={requirement.skill}>
                    <th scope="row" className={TABLE.rowHead}>
                      {requirement.name}
                    </th>
                    <td className={`${TABLE.cell} whitespace-nowrap`}>
                      <Level level={requirement.level} name={requirement.levelName} />
                    </td>
                    <td className={TABLE.cell}>
                      <Tag
                        tone={requirement.importance}
                        icon={requirement.importance === "core" ? Diamond : Circle}
                      >
                        {t(`pathways.importance.${requirement.importance}`)}
                      </Tag>
                    </td>
                    <td className={`${TABLE.cell} py-2 text-meta`}>
                      <ul className="grid gap-1">
                        {requirement.sources.map((source) => (
                          <li key={source.title}>
                            {source.url === undefined ? (
                              source.title
                            ) : (
                              <a href={source.url} target="_blank" rel="noopener noreferrer">
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
        <div className={`grid items-start gap-(--gap) ${pair ? "lg:grid-cols-2" : ""}`}>
          <TextList title={t("pathways.prerequisites")} items={pathway.prerequisites} />
          <TextList title={t("pathways.uncertainties")} items={pathway.uncertainties} />
        </div>
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
  const titleId = useId();
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={titleId} className="grid gap-(--space-2) rounded-lg bg-panel p-(--pad)">
      <h2 id={titleId} className="text-section font-bold tracking-[-0.01em]">
        {title}
      </h2>
      <ul className="grid list-disc gap-1 ps-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
