/**
 * Creating a profile in a folder that has none (MVP S1, S2.3).
 *
 * @packageDocumentation
 */
import type { ProfileFields } from "@pharoam/core";
import { useMutation } from "@tanstack/react-query";
import { useId, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { PlainLayout } from "../layout/plain-layout.tsx";
import { ProfileForm } from "../profile/profile-form.tsx";
import { useSession } from "../profile/session.tsx";
import { Button } from "../ui/button.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";

/**
 * The form that creates `pharoam.md` in the chosen folder.
 *
 * @remarks Files already in the folder are left as they are (MVP S1.3).
 * @param props - The folder's name.
 * @returns The profile form, in the plain layout.
 */
export function CreateProfilePage({ folder }: { readonly folder: string }): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  const { session, profileCreated, disconnect } = useSession();

  const create = useMutation({
    mutationFn: async (fields: ProfileFields) => {
      if (session.status !== "no-profile") return false;
      const created = await session.service.createProfile(fields);
      if (created.ok) profileCreated();
      return created.ok;
    },
  });

  return (
    <PlainLayout>
      <PageTitle
        title={t("createProfile.title", { folder })}
        lead={t("createProfile.lead")}
        titleId={titleId}
      />
      <ProfileForm
        labelledBy={titleId}
        onSubmit={(fields) => {
          create.mutate(fields);
        }}
      >
        {create.data === false || create.isError ? (
          <Notice tone="problem" title={t("createProfile.failed")} />
        ) : null}
        <div className="flex flex-wrap gap-(--space-2)">
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? t("createProfile.creating") : t("createProfile.submit")}
          </Button>
          <Button onClick={() => void disconnect()}>{t("createProfile.chooseAnother")}</Button>
        </div>
      </ProfileForm>
    </PlainLayout>
  );
}
