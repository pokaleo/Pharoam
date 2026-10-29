/**
 * The layout of every page once a profile is open: the sidebar and the canvas.
 *
 * @packageDocumentation
 */
import wordmarkReversed from "@brand/wordmark-reversed.svg";
import wordmark from "@brand/wordmark.svg";
import { Link } from "@tanstack/react-router";
import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { PlaceKind } from "../profile/places.ts";
import { Button } from "../ui/button.tsx";

// The router marks the current page's link with aria-current, which the style follows.
const NAV_LINK =
  "flex min-h-(--nav-row) items-center rounded-md px-2 text-ink-2 hover:bg-panel hover:text-ink aria-[current=page]:bg-active aria-[current=page]:font-semibold aria-[current=page]:text-ink";

/**
 * Lays out a page beside the sidebar: the wordmark, the folder the profile is in, the main areas, and disconnecting.
 *
 * @remarks An open plane: the sidebar sits on the page ground with one soft rule (the design system's app shell).
 * Under 1024px the sidebar stacks above the page.
 * @param props - Where the profile is kept and its name, how many files need attention, what disconnecting does, and
 * the page.
 * @returns The page in the shell.
 */
export function AppShell({
  kind,
  folder,
  attention,
  onDisconnect,
  children,
}: {
  readonly kind: PlaceKind;
  readonly folder: string;
  readonly attention: number;
  readonly onDisconnect: () => void;
  readonly children: ReactNode;
}): ReactElement {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[var(--sidebar)_minmax(0,1fr)]">
      <aside
        aria-label={t("app.name")}
        className="flex flex-col gap-(--space-4) border-line-soft px-3 pt-5 pb-4 max-lg:border-b lg:sticky lg:top-0 lg:h-screen lg:border-e"
      >
        <Link to="/" aria-label={t("app.home")} className="inline-flex self-start rounded-md px-2">
          <picture>
            <source srcSet={wordmarkReversed} media="(prefers-color-scheme: dark)" />
            <img src={wordmark} alt="" className="h-[26px] w-auto" />
          </picture>
        </Link>
        <div className="rounded-md border border-line bg-surface p-2">
          <p className="text-meta text-ink-3">
            {kind === "browser" ? t("shell.storedIn") : t("shell.folder")}
          </p>
          <p className="truncate font-semibold">{kind === "browser" ? t("shell.thisBrowser") : folder}</p>
        </div>
        <nav aria-label={t("shell.main")} className="grid gap-0.5">
          <Link to="/" className={NAV_LINK}>
            {t("shell.profile")}
          </Link>
          <Link to="/skills" className={NAV_LINK}>
            {t("shell.skills")}
          </Link>
          <Link to="/evidence" className={NAV_LINK}>
            {t("shell.evidence")}
          </Link>
          <Link to="/pathways" className={NAV_LINK}>
            {t("shell.pathways")}
          </Link>
          <Link to="/about" className={NAV_LINK}>
            {t("shell.about")}
          </Link>
          <Link to="/attention" className={NAV_LINK}>
            {t("shell.attention")}
            {attention === 0 ? null : (
              <>
                {" "}
                <span className="ms-auto rounded-sm bg-notice-wash px-1.5 text-meta font-semibold text-notice">
                  {attention}
                </span>
              </>
            )}
          </Link>
        </nav>
        <div className="lg:mt-auto">
          {/* Browser storage keeps its files when closed, so it closes rather than disconnects (ADR-0020). */}
          <Button
            variant="quiet"
            aria-label={kind === "browser" ? t("shell.closeLabel") : t("shell.disconnect", { folder })}
            onClick={onDisconnect}
          >
            {kind === "browser" ? t("shell.close") : t("shell.disconnectLabel")}
          </Button>
        </div>
      </aside>
      <main className="min-w-0 px-[clamp(16px,3vw,40px)] pt-8 pb-12">
        <div className="mx-auto max-w-(--canvas-max)">{children}</div>
      </main>
    </div>
  );
}
