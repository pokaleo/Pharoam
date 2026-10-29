/**
 * Notices: inside the block that needs them, never full-screen.
 *
 * @packageDocumentation
 */
import type { ReactElement, ReactNode } from "react";

/** What a notice is about: `attention` for something to look at, `problem` for something that went wrong. */
export type NoticeTone = "attention" | "problem";

const TONES: Record<NoticeTone, string> = {
  attention: "bg-notice-wash border-notice-edge",
  problem: "bg-problem-wash border-problem-edge",
};

/**
 * A notice with a title and what to do next.
 *
 * @remarks Announced to screen readers as an alert, since it appears after an action.
 * @param props - The tone, the title and the explanation.
 * @returns A tinted block, edged in the tone's colour.
 */
export function Notice({
  tone,
  title,
  children,
}: {
  readonly tone: NoticeTone;
  readonly title: string;
  readonly children?: ReactNode;
}): ReactElement {
  return (
    <div role="alert" className={`grid gap-(--space-1) rounded-lg border p-(--pad) ${TONES[tone]}`}>
      <p className="font-semibold">{title}</p>
      {children === undefined ? null : <div className="text-ink-2">{children}</div>}
    </div>
  );
}
