/**
 * The page shown for an address the app doesn't have.
 *
 * @packageDocumentation
 */
import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { PlainLayout } from "../layout/plain-layout.tsx";
import { PageTitle } from "../ui/page-title.tsx";

/**
 * Says there's nothing at this address and links back to the start.
 *
 * @returns The explanation and a link to the start page, in the plain layout.
 */
export function NotFoundPage(): ReactElement {
  const { t } = useTranslation();
  return (
    <PlainLayout>
      <PageTitle title={t("notFound.title")} lead={t("notFound.lead")} />
      <Link to="/" className="text-channel underline underline-offset-[0.18em]">
        {t("notFound.back")}
      </Link>
    </PlainLayout>
  );
}
