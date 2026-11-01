/**
 * The title bar at the top of every page.
 *
 * @packageDocumentation
 */
import { ChevronRight } from "lucide-react";
import { Fragment, type ReactElement, type ReactNode, type Ref } from "react";
import { Icon } from "./icon.tsx";

/**
 * The way back, the title and lead of a page, and the page's actions beside them.
 *
 * @remarks The design system's title bar: the title is a noun at title size, the lead says what the screen answers,
 * and the actions sit at the end of the row, wrapping under the title when there is no room. The crumbs end with the
 * page's own title, marked as the current page.
 * @param props - The title, the sentence that leads into the page, an ID and a ref for the title, the links back to
 * the pages above this one with their navigation's name, and the actions.
 * @returns The page's heading block.
 */
export function PageTitle({
  title,
  lead,
  titleId,
  titleRef,
  crumbs,
  crumbsLabel,
  actions,
}: {
  readonly title: string;
  readonly lead: string;
  readonly titleId?: string;
  readonly titleRef?: Ref<HTMLHeadingElement>;
  readonly crumbs?: readonly ReactElement[];
  readonly crumbsLabel?: string;
  readonly actions?: ReactNode;
}): ReactElement {
  return (
    <div className="mb-(--space-5)">
      {crumbs === undefined ? null : (
        <nav
          aria-label={crumbsLabel}
          className="mb-2 flex flex-wrap items-center gap-1.5 text-meta text-ink-2 [&_a]:text-ink-2"
        >
          {crumbs.map((crumb) => (
            <Fragment key={crumb.key}>
              {crumb}
              <Icon of={ChevronRight} size="xs" className="rtl:-scale-x-100" />
            </Fragment>
          ))}
          <span aria-current="page">{title}</span>
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-(--space-5) gap-y-(--space-3)">
        <div className="min-w-0">
          <h1
            id={titleId}
            ref={titleRef}
            tabIndex={titleRef === undefined ? undefined : -1}
            className="text-title font-extrabold tracking-[-0.025em]"
          >
            {title}
          </h1>
          {lead === "" ? null : <p className="mt-1.5 max-w-[72ch] text-lead text-ink-2">{lead}</p>}
        </div>
        {actions === undefined ? null : <div className="flex flex-wrap gap-(--space-2)">{actions}</div>}
      </div>
    </div>
  );
}
