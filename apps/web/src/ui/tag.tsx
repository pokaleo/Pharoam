/**
 * Tags: the one chip shape every vocabulary item shares.
 *
 * @packageDocumentation
 */
import type { LucideIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { Icon } from "./icon.tsx";

/**
 * Which vocabulary item a tag shows.
 *
 * @remarks The four sources of a level; record states; the gap groups and a requirement's weight; trust markers. A
 * tested result takes the channel, an AI-made thing a dashed edge, and only real problems take amber or red.
 */
export type TagTone =
  | "neutral"
  | "self-reported"
  | "ai-judged"
  | "demonstrated"
  | "ai-correlated"
  | "custom"
  | "attention"
  | "problem"
  | "shown"
  | "skill"
  | "supported"
  | "claimed"
  | "below"
  | "unknown"
  | "core"
  | "helpful"
  | "untrusted";

const TONES: Record<TagTone, string> = {
  neutral: "bg-panel text-ink-2",
  "self-reported": "bg-src-self-wash text-src-self",
  "ai-judged": "bg-src-ai-wash text-src-ai outline-1 -outline-offset-1 outline-dashed outline-ai-edge",
  demonstrated: "bg-src-demo-wash text-src-demo",
  "ai-correlated":
    "bg-src-demo-wash text-src-demo outline-1 -outline-offset-1 outline-dashed outline-src-demo",
  custom: "bg-transparent text-ink-2 inset-ring inset-ring-line-strong",
  attention: "bg-notice-wash text-notice",
  problem: "bg-problem-wash text-problem",
  shown: "bg-ink text-ground",
  skill: "bg-panel text-ink",
  supported: "bg-channel-wash text-channel",
  claimed: "bg-src-self-wash text-src-self",
  below: "bg-panel text-ink",
  unknown: "bg-transparent text-ink-2 outline-1 -outline-offset-1 outline-dotted outline-line-strong",
  core: "bg-ink text-ground",
  helpful: "bg-transparent text-ink-2 inset-ring inset-ring-line-strong",
  untrusted: "bg-notice-wash text-notice",
};

/**
 * A short label for one vocabulary item, with its icon.
 *
 * @remarks Colour is never the only signal: every tag has a word, and most an icon (the design system's tags).
 * @param props - The item it shows, its icon, anything drawn before the word (such as the AI monogram), and the word.
 * @returns A chip with the icon and the word, in the item's colours.
 */
export function Tag({
  tone = "neutral",
  icon,
  mark,
  children,
}: {
  readonly tone?: TagTone;
  readonly icon?: LucideIcon | undefined;
  readonly mark?: ReactNode;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <span
      className={`inline-flex min-h-(--chip) shrink-0 items-center gap-[5px] rounded-sm ps-1.5 pe-2 text-meta leading-none font-semibold whitespace-nowrap ${TONES[tone]}`}
    >
      {icon === undefined ? null : <Icon of={icon} size="sm" />}
      {mark}
      {children}
    </span>
  );
}
