/**
 * The layout of every page once a profile is open: the sidebar and the canvas.
 *
 * @packageDocumentation
 */
import sealReversed from "@brand/seal-reversed.svg";
import seal from "@brand/seal.svg";
import wordmarkReversed from "@brand/wordmark-reversed.svg";
import wordmark from "@brand/wordmark.svg";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  ClipboardPen,
  Compass,
  FileText,
  Folder,
  HardDrive,
  IdCard,
  LifeBuoy,
  ListChecks,
  Lock,
  LogOut,
  Map as MapIcon,
  Menu,
  ScrollText,
  Settings,
  Sprout,
  TriangleAlert,
  Unplug,
  UserRoundPen,
  X,
  type LucideIcon,
} from "lucide-react";
import { useId, useState, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LICENCES_FILE } from "../build/licences-file.ts";
import type { PlaceKind } from "../profile/places.ts";
import { Icon } from "../ui/icon.tsx";

// One row of the sidebar: icon, words, and an optional count at the end. The router marks the current page's link
// with aria-current, which the style follows.
const NAV_ROW =
  "flex min-h-(--nav-row) w-full items-center gap-2.5 rounded-md px-2 text-start text-body text-ink-2 no-underline";
const NAV_LINK = `${NAV_ROW} hover:bg-panel hover:text-ink aria-[current=page]:bg-active aria-[current=page]:font-semibold aria-[current=page]:text-ink forced-colors:aria-[current=page]:outline-2`;

// The page each address belongs to, for the phone top bar's title.
const SECTIONS = [
  ["/skills", "shell.skills"],
  ["/evidence", "shell.evidence"],
  ["/review", "shell.review"],
  ["/scan", "shell.review"],
  ["/pathways", "shell.pathways"],
  ["/about", "shell.about"],
  ["/attention", "shell.attention"],
  ["/activity", "shell.activity"],
] as const;

/**
 * Lays out a page beside the sidebar: the wordmark, where the profile is kept, the main areas, the areas still to
 * come, and closing the profile.
 *
 * @remarks The design system's open plane: the sidebar sits on the page ground with one soft rule. Areas the design
 * system has places for but this version doesn't have yet are shown in their places, marked "Later", and are not
 * links. Under 1024px the sidebar folds behind a menu button in a top bar that names the page.
 * @param props - Where the profile is kept and its name, how many files need attention and how many AI suggestions
 * wait for review, what disconnecting does, and the page.
 * @returns The page in the shell.
 */
export function AppShell({
  kind,
  folder,
  attention,
  review,
  onDisconnect,
  children,
}: {
  readonly kind: PlaceKind;
  readonly folder: string;
  readonly attention: number;
  readonly review: number;
  readonly onDisconnect: () => void;
  readonly children: ReactNode;
}): ReactElement {
  const { t } = useTranslation();
  const sidebarId = useId();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // The menu stays open only on the page it was opened on, so following a link closes it.
  const [openOn, setOpenOn] = useState<string | undefined>(undefined);
  const open = openOn === pathname;
  const section = SECTIONS.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "shell.profile";
  const browser = kind === "browser";

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[var(--sidebar)_minmax(0,1fr)]">
      <header className="sticky top-0 z-10 flex min-h-[52px] items-center gap-(--space-3) border-b border-line-soft bg-ground px-4 lg:hidden">
        <button
          type="button"
          aria-label={t("shell.menu")}
          aria-expanded={open}
          aria-controls={sidebarId}
          onClick={() => {
            setOpenOn(open ? undefined : pathname);
          }}
          className="inline-grid size-(--control) place-items-center rounded-md text-ink hover:bg-panel-2"
        >
          <Icon of={open ? X : Menu} />
        </button>
        <Seal className="size-[26px]" />
        <span className="min-w-0 flex-1 truncate font-semibold">{t(section)}</span>
      </header>
      <aside
        id={sidebarId}
        aria-label={t("app.name")}
        data-open={open}
        className="flex-col gap-(--space-4) border-line-soft px-3 pt-5 pb-4 max-lg:fixed max-lg:inset-x-0 max-lg:top-[52px] max-lg:bottom-0 max-lg:z-20 max-lg:hidden max-lg:overflow-y-auto max-lg:bg-ground max-lg:data-[open=true]:flex lg:sticky lg:top-0 lg:flex lg:h-screen lg:overflow-y-auto lg:border-e"
      >
        <Link
          to="/"
          aria-label={t("app.home")}
          className="inline-flex self-start rounded-md px-2 max-lg:hidden"
        >
          <picture>
            <source srcSet={wordmarkReversed} media="(prefers-color-scheme: dark)" />
            <img src={wordmark} alt="" className="h-[26px] w-auto" />
          </picture>
        </Link>
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-0.5 rounded-md border border-line bg-surface p-2">
          <Icon of={browser ? HardDrive : Folder} className="row-span-2 text-ink-2" />
          <p className="sr-only">{browser ? t("shell.storedIn") : t("shell.folder")}</p>
          <p className="truncate font-semibold">{browser ? t("shell.thisBrowser") : folder}</p>
          <p className="text-meta text-ink-2">{browser ? t("shell.keptBrowser") : t("shell.keptFolder")}</p>
        </div>
        <nav aria-label={t("shell.main")} className="flex flex-1 flex-col gap-0.5">
          <Link to="/" className={NAV_LINK} activeOptions={{ exact: true }}>
            <Icon of={IdCard} />
            {t("shell.profile")}
          </Link>
          <Link to="/skills" className={NAV_LINK}>
            <Icon of={MapIcon} />
            {t("shell.skills")}
          </Link>
          <Link to="/evidence" className={NAV_LINK}>
            <Icon of={FileText} />
            {t("shell.evidence")}
          </Link>
          <Link to="/review" className={NAV_LINK}>
            <Icon of={ListChecks} />
            {t("shell.review")}
            {review === 0 ? null : (
              <>
                {" "}
                <span className="ms-auto text-meta text-ink-2 tabular-nums">{review}</span>
              </>
            )}
          </Link>
          <Later icon={ClipboardPen} name={t("shell.assess")} />
          <p className="px-2 pt-3.5 pb-1 text-meta text-ink-3">{t("shell.whereNext")}</p>
          <Link to="/pathways" className={NAV_LINK}>
            <Icon of={Compass} />
            {t("shell.pathways")}
          </Link>
          <Later icon={Sprout} name={t("shell.plan")} />
          <Later icon={BriefcaseBusiness} name={t("shell.prepare")} />
          <div className="mt-(--space-5) grid gap-0.5 lg:mt-auto">
            <Link to="/attention" className={NAV_LINK}>
              <Icon of={TriangleAlert} />
              {t("shell.attention")}
              {attention === 0 ? null : (
                <>
                  {" "}
                  <span className="ms-auto text-meta text-notice tabular-nums">{attention}</span>
                </>
              )}
            </Link>
            <Link to="/about" className={NAV_LINK}>
              <Icon of={UserRoundPen} />
              {t("shell.about")}
            </Link>
            <Link to="/activity" className={NAV_LINK}>
              <Icon of={ScrollText} />
              {t("shell.activity")}
            </Link>
            <Link to="/settings" className={NAV_LINK}>
              <Icon of={Settings} />
              {t("shell.settings")}
            </Link>
            <Later icon={LifeBuoy} name={t("shell.help")} />
            <Later icon={Lock} name={t("shell.lock")} />
            {/* Browser storage keeps its files when closed, so it closes rather than disconnects (ADR-0020). */}
            <button
              type="button"
              aria-label={browser ? t("shell.closeLabel") : t("shell.disconnect", { folder })}
              onClick={onDisconnect}
              className={`${NAV_ROW} cursor-pointer hover:bg-panel hover:text-ink`}
            >
              <Icon of={browser ? LogOut : Unplug} />
              {browser ? t("shell.close") : t("shell.disconnectLabel")}
            </button>
          </div>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-col px-4 pt-5 pb-10 lg:px-[clamp(16px,3vw,40px)] lg:pt-8 lg:pb-12">
        <main className="mx-auto w-full max-w-(--canvas-max) flex-1">{children}</main>
        <footer className="mx-auto mt-(--space-7) flex w-full max-w-(--canvas-max) flex-wrap items-center justify-between gap-x-(--space-5) gap-y-(--space-2) border-t border-line-soft pt-(--space-5) text-meta text-ink-2">
          <span className="flex items-center gap-1.5">
            <Seal className="size-4" />
            {browser ? t("shell.footerBrowser") : t("shell.footer")}
          </span>
          <a href={`${import.meta.env.BASE_URL}${LICENCES_FILE}`} className="text-ink-2">
            {t("app.licences")}
          </a>
        </footer>
      </div>
    </div>
  );
}

// The seal, the brand's identifier, drawn for the system's theme: graphite on light grounds, reversed on dark ones.
// It is decoration beside the page's name, so screen readers skip it.
function Seal({ className }: { readonly className: string }): ReactElement {
  return (
    <picture className="shrink-0">
      <source srcSet={sealReversed} media="(prefers-color-scheme: dark)" />
      <img src={seal} alt="" className={className} />
    </picture>
  );
}

// An area the design system has a place for that this version doesn't have yet: shown, marked, never a link.
function Later({ icon, name }: { readonly icon: LucideIcon; readonly name: string }): ReactElement {
  const { t } = useTranslation();
  return (
    <span aria-disabled="true" className={`${NAV_ROW} text-ink-3`}>
      <Icon of={icon} />
      {name}
      <span className="ms-auto text-meta">
        {t("shell.later")}
        <span className="sr-only">{`, ${t("shell.laterLabel")}`}</span>
      </span>
    </span>
  );
}
