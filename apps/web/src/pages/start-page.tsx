/**
 * The start page, shown before a profile is open.
 *
 * @packageDocumentation
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { PlainLayout } from "../layout/plain-layout.tsx";
import { filesFromFolder } from "../profile/copy-files.ts";
import type { PlaceError, ProfilePlace } from "../profile/places.ts";
import { useSession } from "../profile/session.tsx";
import { Button } from "../ui/button.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";
import type { Result } from "@pharoam/core";

/** Why the place didn't open, with its name when the person got as far as choosing one. */
type OpenFailure = (PlaceError | { readonly kind: "not-empty" }) & { readonly folder?: string };

/** How the person opens their profile: choosing a place, reopening the last one, or bringing files in. */
type Opening = "choose" | "reopen" | { readonly files: readonly File[] };

/**
 * Says what Pharoam does and where the profile lives, and opens it.
 *
 * @remarks The person's data stays in storage they choose, never on Pharoam's infrastructure (AGENTS.md hard rule 1),
 * so the page says so first. A folder from an earlier visit is offered again by name, and nothing is read until the
 * person asks and the browser grants permission (MVP S2.2). Where the browser can't open a folder, the profile is
 * kept in the browser's own storage, and can start from a folder the person picks (ADR-0020).
 * @returns The title, where the profile lives, and the ways to open it, in the plain layout.
 */
export function StartPage(): ReactElement {
  const { t } = useTranslation();
  const { services, connect } = useSession();
  const { places } = services;
  const browser = places.kind === "browser";
  const remembered = useQuery({
    queryKey: ["remembered-place"],
    queryFn: async () => (await places.remembered()) ?? null,
    // Asked afresh each time the page shows, so a folder forgotten on disconnecting is never offered.
    gcTime: 0,
  });
  const open = useMutation({
    mutationFn: async (how: Opening): Promise<OpenFailure | undefined> => {
      const place: Result<ProfilePlace, PlaceError | { readonly kind: "not-empty" }> =
        how === "choose"
          ? await places.choose()
          : how === "reopen"
            ? await places.reopen()
            : ((await places.bringIn?.(await filesFromFolder(how.files))) ?? (await places.choose()));
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
        <p className="text-ink-2">{browser ? t("start.browser.storage") : t("start.storage")}</p>
        {open.data === undefined ? null : <OpenFailureNotice failure={open.data} browser={browser} />}
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
                {browser ? t("start.browser.reopen") : t("start.reopen", { folder })}
              </Button>
            )}
            {browser && folder !== undefined ? null : (
              <Button
                variant={folder === undefined ? "primary" : "secondary"}
                disabled={busy}
                onClick={() => {
                  open.mutate("choose");
                }}
              >
                {browser ? t("start.browser.choose") : t("start.choose")}
              </Button>
            )}
          </div>
          {browser ? null : <p className="text-meta text-ink-2">{t("start.chooseHint")}</p>}
          {browser && remembered.isSuccess && folder === undefined ? (
            <BringInFolder
              disabled={busy}
              onPick={(files) => {
                open.mutate({ files });
              }}
            />
          ) : null}
          <p role="status" className="text-meta text-ink-2">
            {open.isPending ? t("start.opening") : ""}
          </p>
        </div>
      </div>
    </PlainLayout>
  );
}

// A folder picker for files to bring into browser storage: a file input that takes a whole folder, shown as a button.
function BringInFolder({
  disabled,
  onPick,
}: {
  readonly disabled: boolean;
  readonly onPick: (files: readonly File[]) => void;
}): ReactElement {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="grid gap-(--space-1)">
      <div>
        <label
          htmlFor={id}
          className="inline-flex min-h-(--control) cursor-pointer items-center rounded-md border border-line-strong bg-surface px-[calc(var(--control)*0.4)] font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus)"
        >
          {t("start.browser.bringIn")}
          <input
            id={id}
            type="file"
            multiple
            disabled={disabled}
            aria-describedby={`${id}-hint`}
            className="sr-only"
            // React has no prop for picking a whole folder; every browser that keeps profiles reads this attribute.
            ref={(input) => {
              input?.setAttribute("webkitdirectory", "");
            }}
            onChange={(event) => {
              const files = [...(event.currentTarget.files ?? [])];
              if (files.length > 0) onPick(files);
            }}
          />
        </label>
      </div>
      <p id={`${id}-hint`} className="text-meta text-ink-2">
        {t("start.browser.bringInHint")}
      </p>
    </div>
  );
}

function OpenFailureNotice({
  failure,
  browser,
}: {
  readonly failure: OpenFailure;
  readonly browser: boolean;
}): ReactElement | null {
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
    case "not-empty":
      return (
        <Notice tone="attention" title={t("start.browser.notEmpty.title")}>
          {t("start.browser.notEmpty.text")}
        </Notice>
      );
    case "unavailable":
      if (browser) {
        return (
          <Notice tone="problem" title={t("start.browser.unavailable.title")}>
            {t("start.browser.unavailable.text")}
          </Notice>
        );
      }
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
