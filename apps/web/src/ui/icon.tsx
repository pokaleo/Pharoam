/**
 * Icons: Lucide's outline set, as the design system draws it.
 *
 * @packageDocumentation
 */
import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";

/** How big an icon is: `md` at the density's icon size, `sm` (14px) in tags and meta lines, `xs` (12px) in crumbs. */
export type IconSize = "md" | "sm" | "xs";

const SIZES: Record<IconSize, string> = {
  md: "size-(--icon)",
  sm: "size-3.5",
  xs: "size-3",
};

/**
 * Draws one Lucide icon at the design system's stroke, in the text's colour.
 *
 * @remarks Icons are never the only signal: the words beside them say what they mean, so every icon is hidden from
 * screen readers (Lucide adds `aria-hidden` when no label is given). Grey unless the role gives it a colour.
 * @param props - The icon, its size, and any extra classes, such as a colour.
 * @returns The icon's SVG.
 */
export function Icon({
  of,
  size = "md",
  className = "",
}: {
  readonly of: LucideIcon;
  readonly size?: IconSize;
  readonly className?: string;
}): ReactElement {
  const Glyph = of;
  return <Glyph strokeWidth={1.75} className={`shrink-0 ${SIZES[size]} ${className}`} />;
}
