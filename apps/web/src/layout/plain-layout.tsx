/**
 * The layout of pages shown before a profile is open: the brand and one column of content.
 *
 * @packageDocumentation
 */
import wordmarkReversed from "@brand/wordmark-reversed.svg";
import wordmark from "@brand/wordmark.svg";
import { Link } from "@tanstack/react-router";
import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

/**
 * Lays out a page with the brand above one column of content.
 *
 * @remarks The wordmark is drawn for the theme the system uses, and the link carries the name in words, so the logo
 * never stands alone.
 * @param props - The page's content.
 * @returns The page.
 */
export function PlainLayout({ children }: { readonly children: ReactNode }): ReactElement {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-(--pad) pt-(--space-5) mx-auto max-w-(--canvas-max)">
        <Link to="/" aria-label={t("app.home")} className="inline-flex rounded-md">
          <picture>
            <source srcSet={wordmarkReversed} media="(prefers-color-scheme: dark)" />
            <img src={wordmark} alt="" className="h-[26px] w-auto" />
          </picture>
        </Link>
      </header>
      <main className="px-(--pad) py-(--space-7) mx-auto max-w-(--canvas-max)">{children}</main>
    </div>
  );
}
