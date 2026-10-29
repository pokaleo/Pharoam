/**
 * The page shown in browsers v0.1 can't run in.
 *
 * @packageDocumentation
 */
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { PlainLayout } from "../layout/plain-layout.tsx";
import { PageTitle } from "../ui/page-title.tsx";

/**
 * Says the browser isn't supported yet, why, and which browsers work.
 *
 * @remarks v0.1 stores profiles only in a local folder, which needs the File System Access API of desktop Chromium
 * browsers (MVP §3).
 * @returns The explanation and the browsers to use, in the plain layout.
 */
export function UnsupportedPage(): ReactElement {
  const { t } = useTranslation();
  return (
    <PlainLayout>
      <PageTitle title={t("unsupported.title")} lead={t("unsupported.lead")} />
      <p className="max-w-[72ch] text-ink-2">{t("unsupported.browsers")}</p>
    </PlainLayout>
  );
}
