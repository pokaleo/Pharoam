/**
 * Empty states.
 *
 * @packageDocumentation
 */
import type { ReactElement, ReactNode } from "react";

/**
 * Stands in for a list with nothing in it yet: a dashed frame, why it is empty, and the way to fill it.
 *
 * @remarks An empty section keeps its frame, so the screen doesn't change shape when the first item arrives.
 * @param props - What to say, and the action that fills it.
 * @returns The dashed block.
 */
export function Empty({
  text,
  action,
}: {
  readonly text: string;
  readonly action?: ReactNode;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-(--space-4) rounded-lg border border-dashed border-line-strong px-(--pad) py-(--space-4)">
      <p className="max-w-[56ch] text-ink-2">{text}</p>
      {action}
    </div>
  );
}
