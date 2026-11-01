/**
 * Notices: inside the block that needs them, never full-screen.
 *
 * @packageDocumentation
 */
import { CircleAlert, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { Icon } from "./icon.tsx";

/**
 * What a notice is about: `attention` for something to look at, `problem` for something that went wrong, `info` for
 * a quiet note that is neither.
 */
export type NoticeTone = "attention" | "problem" | "info";

const TONES: Record<
  NoticeTone,
  { readonly box: string; readonly icon: LucideIcon; readonly colour: string }
> = {
  attention: { box: "bg-notice-wash border-notice-edge", icon: TriangleAlert, colour: "text-notice" },
  problem: { box: "bg-problem-wash border-problem-edge", icon: CircleAlert, colour: "text-problem" },
  info: { box: "bg-panel border-line", icon: Info, colour: "text-ink-2" },
};

/**
 * A notice with an icon, a title, what to do next, and actions.
 *
 * @remarks Attention and problem notices appear after an action, so they are announced as alerts; an info notice is
 * part of the page and is not. Under 768px the actions move under the text.
 * @param props - The tone, the title, the explanation, and the actions.
 * @returns A block tinted and edged in the tone's colours.
 */
export function Notice({
  tone,
  title,
  children,
  actions,
}: {
  readonly tone: NoticeTone;
  readonly title: string;
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
}): ReactElement {
  const { box, icon, colour } = TONES[tone];
  return (
    <div
      role={tone === "info" ? undefined : "alert"}
      className={`grid grid-cols-[auto_1fr] items-start gap-(--space-3) rounded-lg border px-(--pad) py-(--space-3) md:grid-cols-[auto_1fr_auto] ${box}`}
    >
      <Icon of={icon} className={`mt-0.5 ${colour}`} />
      <div className="grid gap-(--space-1)">
        <p className="font-semibold">{title}</p>
        {children === undefined ? null : <div className="text-ink-2">{children}</div>}
      </div>
      {actions === undefined ? null : (
        <div className="col-start-2 flex flex-wrap items-center gap-(--space-2) md:col-start-3">
          {actions}
        </div>
      )}
    </div>
  );
}
