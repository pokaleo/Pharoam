/**
 * The title block at the top of every page.
 *
 * @packageDocumentation
 */
import type { ReactElement } from "react";

/**
 * The title and lead of a page.
 *
 * @param props - The title, the sentence that leads into the page, and an ID for the title when something is
 * labelled by it.
 * @returns The page's heading block.
 */
export function PageTitle({
  title,
  lead,
  titleId,
}: {
  readonly title: string;
  readonly lead: string;
  readonly titleId?: string;
}): ReactElement {
  return (
    <div className="mb-(--space-5) grid gap-(--space-2)">
      <h1 id={titleId} className="text-title font-extrabold tracking-[-0.025em]">
        {title}
      </h1>
      <p className="text-lead text-ink-2 max-w-[72ch]">{lead}</p>
    </div>
  );
}
