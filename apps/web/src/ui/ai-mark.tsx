/**
 * The AI monogram, on everything AI-made.
 *
 * @packageDocumentation
 */
import type { ReactElement } from "react";
import type { IconSize } from "./icon.tsx";

const SIZES: Record<IconSize, string> = {
  md: "size-(--icon)",
  sm: "size-3.5",
  xs: "size-3",
};

/**
 * Draws the AI monogram from the theme's artwork, in the text's colour.
 *
 * @remarks Everything AI-made carries it with a dashed edge, the model's name and a disclaimer (hard rule 6, the
 * design system's honest AI). It is hidden from screen readers, since the words beside it always say it is AI.
 * @param props - Its size, as icons are sized.
 * @returns The monogram.
 */
export function AiMark({ size = "sm" }: { readonly size?: IconSize }): ReactElement {
  return <span aria-hidden="true" className={`ai-mark ${SIZES[size]}`} />;
}
