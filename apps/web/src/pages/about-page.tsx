/**
 * "About you": the person's own fields in `pharoam.md`, and its overview (MVP S3).
 *
 * @packageDocumentation
 */
import { pathwaySummaries, type CoreService, type ProfileFields } from "@pharoam/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { withHiddenFocus } from "../profile/profile-fields.ts";
import { ProfileForm } from "../profile/profile-form.tsx";
import { useSession } from "../profile/session.tsx";
import { Button } from "../ui/button.tsx";
import { ChangedOutsideNotice } from "../ui/changed-outside.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";

/** How a save ended: saved, or why not. */
type SaveOutcome = "saved" | "changed-outside" | "failed";

/**
 * Edits the headline, situation, country and focus, and brings the overview up to date.
 *
 * @remarks Saving rewrites only those fields and the time of the change; fields Pharoam doesn't know, the focus the
 * form can't show, and the person's own words in the body stay as written (MVP S3.1, S3.2). A file changed in the
 * folder since it was read is never overwritten (AD10).
 * @param props - The open profile's service.
 * @returns The page's title, the profile form and the overview block.
 */
export function AboutPage({ service }: { readonly service: CoreService }): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  const { services, changed } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  const current = currentFields(service);

  const save = useMutation({
    mutationFn: async (fields: ProfileFields): Promise<SaveOutcome> => {
      const shown = content.data === undefined ? [] : pathwaySummaries(content.data).map((p) => p.slug);
      const saved = await service.updateProfile(withHiddenFocus(fields, current?.focus, shown));
      changed();
      if (saved.ok) return "saved";
      return saved.error.kind === "conflict" ? "changed-outside" : "failed";
    },
  });

  return (
    <>
      <PageTitle title={t("about.title")} lead={t("about.lead")} titleId={titleId} />
      <div className="grid max-w-[72ch] gap-(--space-7)">
        <ProfileForm
          labelledBy={titleId}
          initial={current ?? {}}
          onSubmit={(fields) => {
            save.mutate(fields);
          }}
        >
          <SaveNotice outcome={save.data} />
          <div>
            <Button type="submit" variant="primary" disabled={save.isPending}>
              {t("about.save")}
            </Button>
          </div>
        </ProfileForm>
        <OverviewBlock service={service} />
      </div>
    </>
  );
}

function SaveNotice({ outcome }: { readonly outcome: SaveOutcome | undefined }): ReactElement | null {
  const { t } = useTranslation();
  switch (outcome) {
    case undefined:
      return null;
    case "saved":
      return (
        <p role="status" className="text-ink-2">
          {t("about.saved")}
        </p>
      );
    case "changed-outside":
      return (
        <ChangedOutsideNotice title={t("about.changedOutside.title")} text={t("about.changedOutside.text")} />
      );
    case "failed":
      return <Notice tone="problem" title={t("about.failed")} />;
  }
}

// The overview is written from the evidence and skills whenever they change (MVP S3.3); the button does the same by
// hand, and is how the person retries after fixing broken markers in an editor.
function OverviewBlock({ service }: { readonly service: CoreService }): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  const { changed } = useSession();
  const refresh = useMutation({
    mutationFn: async () => {
      const refreshed = await service.refreshOverview();
      changed();
      return refreshed.ok;
    },
  });
  const problem = service.overviewProblem();

  return (
    <section aria-labelledby={titleId} className="grid gap-(--space-3) rounded-lg bg-panel p-(--pad)">
      <h2 id={titleId} className="text-section font-bold">
        {t("about.overview.title")}
      </h2>
      <p className="text-ink-2">{t("about.overview.text")}</p>
      {problem?.kind === "overview-markers" ? (
        <Notice tone="attention" title={t("about.overview.markers.title")}>
          {t("about.overview.markers.text")}
        </Notice>
      ) : refresh.data === true ? (
        <p role="status" className="text-ink-2">
          {t("about.overview.done")}
        </p>
      ) : refresh.data === false ? (
        <Notice tone="problem" title={t("about.overview.failed")} />
      ) : null}
      <div>
        <Button
          disabled={refresh.isPending}
          onClick={() => {
            refresh.mutate();
          }}
        >
          {t("about.overview.refresh")}
        </Button>
      </div>
    </section>
  );
}

// The fields of pharoam.md the form edits, as they are now.
function currentFields(service: CoreService): ProfileFields | undefined {
  const record = service.profile()?.record;
  if (record?.schema !== "pharoam/1") return undefined;
  return {
    ...(record.headline === undefined ? {} : { headline: record.headline }),
    ...(record.situation === undefined
      ? {}
      : {
          situation: {
            stage: record.situation.stage,
            ...(record.situation.field === undefined ? {} : { field: record.situation.field }),
          },
        }),
    ...(record.region === undefined ? {} : { region: record.region }),
    ...(record.focus === undefined ? {} : { focus: record.focus }),
  };
}
