/**
 * The skills overview: each skill with its one level, where it came from and since when (MVP S9).
 *
 * @packageDocumentation
 */
import type { CoreService } from "@pharoam/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../profile/session.tsx";
import { dayName, levelName, sourceName } from "../skills/labels.ts";
import { buttonClassName } from "../ui/button.tsx";
import { SelectField, TextField } from "../ui/field.tsx";
import { PageTitle } from "../ui/page-title.tsx";

/**
 * Lists the person's skills, narrowed by a search or a domain.
 *
 * @remarks One level per skill, picked by the written order and never blended (MVP S9.1, PRD C4); in v0.1 that is
 * the latest self-reported level. No scores or totals. Custom skills are marked as the person's own (MVP S8.2).
 * @param props - The open profile's service.
 * @returns The title, the ways to add, the search and domain filter, and the table of skills.
 */
export function SkillsPage({ service }: { readonly service: CoreService }): ReactElement {
  const { t } = useTranslation();
  const { services } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("");
  const vocabulary = content.data?.skills ?? [];
  const all = service.skillView(vocabulary);
  const shown = service.skillView(vocabulary, {
    ...(query.trim() === "" ? {} : { query: query.trim() }),
    ...(domain === "" ? {} : { domain }),
  });
  const domains = [...new Set(all.flatMap((item) => (item.domain === undefined ? [] : [item.domain])))].sort(
    new Intl.Collator(t("app.locale")).compare,
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-(--space-3)">
        <PageTitle title={t("skills.title")} lead={t("skills.lead", { count: all.length })} />
        <div className="mb-(--space-5) flex flex-wrap gap-(--space-2)">
          <Link to="/skills/custom" className={buttonClassName("secondary")}>
            {t("skills.addCustom")}
          </Link>
          <Link to="/skills/record" className={buttonClassName("primary")}>
            {t("skills.record")}
          </Link>
        </div>
      </div>
      {all.length === 0 ? (
        <p className="max-w-[72ch] rounded-lg border border-dashed border-line-strong p-(--pad) text-ink-2">
          {t("skills.empty")}
        </p>
      ) : (
        <div className="grid gap-(--space-4) rounded-lg bg-surface p-(--pad)">
          <div className="flex flex-wrap gap-(--space-3)">
            <div className="min-w-56 flex-1">
              <TextField
                type="search"
                label={t("skills.search")}
                value={query}
                onChange={(event) => {
                  setQuery(event.currentTarget.value);
                }}
              />
            </div>
            <div className="min-w-56">
              <SelectField
                label={t("skills.domain")}
                value={domain}
                onChange={(event) => {
                  setDomain(event.currentTarget.value);
                }}
                options={[
                  { value: "", label: t("skills.allDomains") },
                  ...domains.map((name) => ({ value: name, label: name })),
                ]}
              />
            </div>
          </div>
          <table className="w-full border-collapse text-start">
            <caption className="sr-only">{t("skills.table")}</caption>
            <thead>
              <tr className="border-b border-line text-meta text-ink-2">
                <th scope="col" className="py-2 pe-3 text-start font-semibold">
                  {t("skills.columns.skill")}
                </th>
                <th scope="col" className="py-2 pe-3 text-start font-semibold">
                  {t("skills.columns.level")}
                </th>
                <th scope="col" className="py-2 text-start font-semibold">
                  {t("skills.columns.source")}
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => (
                <tr key={item.skill} className="border-b border-line-soft">
                  <th scope="row" className="py-(--space-2) pe-3 text-start font-normal">
                    <Link
                      to="/skills/$skill"
                      params={{ skill: item.skill }}
                      className="font-semibold text-ink underline-offset-[0.18em] hover:underline"
                    >
                      {item.name}
                    </Link>
                    {item.custom ? (
                      <span className="ms-2 rounded-sm bg-panel px-1.5 text-meta text-ink-2">
                        {t("skills.own")}
                      </span>
                    ) : null}
                  </th>
                  <td className="py-(--space-2) pe-3">
                    {item.shown === undefined ? (
                      <span className="text-ink-2">{t("skills.noLevel")}</span>
                    ) : (
                      <>
                        <span className="font-semibold">{levelName(content.data, item.shown.level)}</span>{" "}
                        <span className="text-ink-3">{item.shown.level}</span>
                      </>
                    )}
                  </td>
                  <td className="py-(--space-2) text-meta text-ink-2">
                    {item.shown === undefined
                      ? null
                      : t("skills.since", {
                          source: sourceName(t, item.shown.provenance),
                          date: dayName(t, item.shown.since),
                        })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 ? <p className="text-ink-2">{t("skills.noMatch")}</p> : null}
        </div>
      )}
    </>
  );
}
