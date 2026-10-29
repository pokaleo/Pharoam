/**
 * The start page, shown before a profile is open.
 *
 * @packageDocumentation
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { PlainLayout } from "../layout/plain-layout.tsx";
import { PageTitle } from "../ui/page-title.tsx";
import type { PlaceError } from "../profile/places.ts";
import { useSession } from "../profile/session.tsx";
import { Button } from "../ui/button.tsx";
import { Notice } from "../ui/notice.tsx";

/** Why the folder didn't open, with its name when the person got as far as choosing one. */
type OpenFailure = PlaceError & { readonly folder?: string };

/**
 * Says what Pharoam does and where the profile lives, and opens the folder it is in.
 *
 * @remarks The person's data stays in storage they choose, never on Pharoam's infrastructure (AGENTS.md hard rule 1),
 * so the page says so first. A folder from an earlier visit is offered again by name, and nothing is read until the
 * person asks and the browser grants permission (MVP S2.2).
 * @returns The title, where the profile lives, and the buttons to open or choose a folder, in the plain layout.
 */
export function StartPage(): ReactElement {
  const { t } = useTranslation();
  const { services, connect } = useSession();
  const remembered = useQuery({
    queryKey: ["remembered-place"],
    queryFn: async () => (await services.places.remembered()) ?? null,
    // Asked afresh each time the page shows, so a folder forgotten on disconnecting is never offered.
    gcTime: 0,
  });
  const open = useMutation({
    mutationFn: async (how: "choose" | "reopen"): Promise<OpenFailure | undefined> => {
      const place = how === "choose" ? await services.places.choose() : await services.places.reopen();
      if (!place.ok) return place.error;
      const connected = await connect(place.value);
      return connected.ok ? undefined : { ...connected.error, folder: place.value.name };
    },
  });
  const folder = remembered.data ?? undefined;
  const busy = open.isPending || remembered.isPending;

  return (
    <PlainLayout>
      <PageTitle title={t("start.title")} lead={t("start.lead")} />
      <div className="grid max-w-[72ch] gap-(--space-5)">
        <p className="text-ink-2">{t("start.storage")}</p>
        {open.data === undefined ? null : <OpenFailureNotice failure={open.data} />}
        <div className="grid gap-(--space-3)">
          <div className="flex flex-wrap gap-(--space-2)">
            {folder === undefined ? null : (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => {
                  open.mutate("reopen");
                }}
              >
                {t("start.reopen", { folder })}
              </Button>
            )}
            <Button
              variant={folder === undefined ? "primary" : "secondary"}
              disabled={busy}
              onClick={() => {
                open.mutate("choose");
              }}
            >
              {t("start.choose")}
            </Button>
          </div>
          <p className="text-meta text-ink-2">{t("start.chooseHint")}</p>
          <p role="status" className="text-meta text-ink-2">
            {open.isPending ? t("start.opening") : ""}
          </p>
        </div>
      </div>
    </PlainLayout>
  );
}

function OpenFailureNotice({ failure }: { readonly failure: OpenFailure }): ReactElement | null {
  const { t } = useTranslation();
  switch (failure.kind) {
    case "cancelled":
      return null;
    case "denied":
      return (
        <Notice tone="attention" title={t("start.denied.title")}>
          {t("start.denied.text")}
        </Notice>
      );
    case "forgotten":
      return (
        <Notice tone="attention" title={t("start.forgotten.title")}>
          {t("start.forgotten.text")}
        </Notice>
      );
    case "unavailable":
      return (
        <Notice
          tone="problem"
          title={
            failure.folder === undefined
              ? t("start.unavailable.titleNoFolder")
              : t("start.unavailable.title", { folder: failure.folder })
          }
        >
          {t("start.unavailable.text")}
        </Notice>
      );
  }
}
