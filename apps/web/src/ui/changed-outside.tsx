/**
 * The notice for a save refused because the file changed in the folder since Pharoam read it.
 *
 * @packageDocumentation
 */
import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "./notice.tsx";

/**
 * Says nothing was overwritten, and links to where both versions are compared (MVP S12.1, AD10).
 *
 * @param props - The notice's title and text.
 * @returns The notice, with the link to "Needs attention".
 */
export function ChangedOutsideNotice({
  title,
  text,
}: {
  readonly title: string;
  readonly text?: string;
}): ReactElement {
  const { t } = useTranslation();
  return (
    <Notice tone="attention" title={title}>
      {text === undefined ? null : <p>{text}</p>}
      <Link to="/attention" className="text-channel underline">
        {t("changedOutside.compare")}
      </Link>
    </Notice>
  );
}
