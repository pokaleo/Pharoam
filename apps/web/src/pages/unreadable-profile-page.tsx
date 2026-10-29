/**
 * The page for a folder whose `pharoam.md` can't be read.
 *
 * @packageDocumentation
 */
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { PlainLayout } from "../layout/plain-layout.tsx";
import { PageTitle } from "../ui/page-title.tsx";
import { useSession } from "../profile/session.tsx";
import { Button } from "../ui/button.tsx";

/**
 * Says the profile file can't be read and won't be replaced, and offers another folder.
 *
 * @remarks Creating a profile there would replace a file the person may have edited by hand, so Pharoam never offers
 * it (hard rule 3, MVP S12.2).
 * @param props - The folder's name.
 * @returns The explanation and a way back to choosing a folder, in the plain layout.
 */
export function UnreadableProfilePage({ folder }: { readonly folder: string }): ReactElement {
  const { t } = useTranslation();
  const { disconnect } = useSession();
  return (
    <PlainLayout>
      <PageTitle title={t("unreadableProfile.title", { folder })} lead={t("unreadableProfile.text")} />
      <Button variant="primary" onClick={() => void disconnect()}>
        {t("createProfile.chooseAnother")}
      </Button>
    </PlainLayout>
  );
}
