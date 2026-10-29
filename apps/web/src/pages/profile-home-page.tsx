/**
 * The profile's home page, the first page once a profile is open.
 *
 * @packageDocumentation
 */
import type { CoreService } from "@pharoam/core";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { PageTitle } from "../ui/page-title.tsx";

/**
 * Shows the person's headline and every file read from their folder (MVP S2.1).
 *
 * @remarks Files that need attention are counted and left out until they're fixed (MVP S12.2).
 * @param props - The folder's name and the open profile's service.
 * @returns The headline, the folder, and the list of files read.
 */
export function ProfileHomePage({
  folder,
  service,
}: {
  readonly folder: string;
  readonly service: CoreService;
}): ReactElement {
  const { t } = useTranslation();
  const profile = service.profile()?.record;
  const headline = profile?.schema === "pharoam/1" ? profile.headline : undefined;
  const records = service.records();
  const attention = service.needsAttention();
  const filesLabel = t("profileHome.files", { folder });

  return (
    <>
      <PageTitle title={headline ?? t("profileHome.untitled")} lead={t("profileHome.lead", { folder })} />
      <section
        aria-label={filesLabel}
        className="grid max-w-[72ch] gap-(--space-3) rounded-lg bg-panel p-(--pad)"
      >
        <h2 className="text-section font-bold">{filesLabel}</h2>
        <p className="text-ink-2">
          {t("profileHome.filesCount", { count: records.length })}
          {attention.length === 0 ? "" : ` ${t("profileHome.attention", { count: attention.length })}`}
        </p>
        <ul aria-label={filesLabel} className="grid gap-1 font-mono text-meta">
          {records.map((record) => (
            <li key={record.location}>{record.location}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
