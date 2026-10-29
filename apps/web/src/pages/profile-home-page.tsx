/**
 * The profile's home page, the first page once a profile is open.
 *
 * @packageDocumentation
 */
import type { CoreService } from "@pharoam/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../profile/session.tsx";
import { downloadCopy } from "../profile/copy-files.ts";
import { Button } from "../ui/button.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";

/**
 * Shows the person's headline and every file read from their folder (MVP S2.1).
 *
 * @remarks Files that need attention are counted and left out until they're fixed (MVP S12.2). A profile kept in
 * the browser's own storage also asks the person to keep a copy (ADR-0020).
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
  const { services } = useSession();
  const browser = services.places.kind === "browser";

  return (
    <>
      <PageTitle
        title={headline ?? t("profileHome.untitled")}
        lead={browser ? t("profileHome.leadBrowser") : t("profileHome.lead", { folder })}
      />
      {browser ? <KeepACopy /> : null}
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

// A profile kept only in the browser can be lost with the browser's data, so the person is asked to keep a copy, and
// told whether the browser agreed to keep it (ADR-0020).
function KeepACopy(): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  const { services } = useSession();
  const persisted = useQuery({
    queryKey: ["persisted"],
    queryFn: async () => (await services.places.persisted?.()) ?? false,
  });
  const download = useMutation({
    mutationFn: async () => {
      const copy = await services.places.copy?.();
      if (copy?.ok !== true) return false;
      downloadCopy(copy.value, new Date(), document);
      return true;
    },
  });

  return (
    <section
      aria-labelledby={titleId}
      className="mb-(--space-5) grid max-w-[72ch] gap-(--space-3) rounded-lg border border-notice-edge bg-surface p-(--pad)"
    >
      <h2 id={titleId} className="text-section font-bold">
        {t("copy.title")}
      </h2>
      <p className="text-ink-2">{persisted.data === true ? t("copy.persisted") : t("copy.text")}</p>
      {download.data === false || download.isError ? (
        <Notice tone="problem" title={t("copy.failed")} />
      ) : null}
      <div className="flex flex-wrap items-center gap-(--space-3)">
        <Button
          variant="primary"
          disabled={download.isPending}
          onClick={() => {
            download.mutate();
          }}
        >
          {t("copy.download")}
        </Button>
        <p role="status" className="text-meta text-ink-2">
          {download.data === true ? t("copy.downloaded") : ""}
        </p>
      </div>
    </section>
  );
}
