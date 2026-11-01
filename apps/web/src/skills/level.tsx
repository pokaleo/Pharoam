/**
 * A level: a named step, never a meter.
 *
 * @packageDocumentation
 */
import type { Provenance } from "@pharoam/core";
import type { ReactElement } from "react";
import { AiMark } from "../ui/ai-mark.tsx";

/** How big a level is drawn: `md` in rows and lines, `lg` as a screen's main figure. */
export type LevelSize = "md" | "lg";

// The five treads of the stair, lowest first, at each size.
const TREADS: Record<LevelSize, readonly string[]> = {
  md: ["h-1", "h-1.5", "h-2", "h-2.5", "h-3"],
  lg: ["h-2", "h-3", "h-4", "h-5", "h-6"],
};

const SIZES: Record<LevelSize, { readonly level: string; readonly stairs: string }> = {
  md: { level: "gap-1.5 font-semibold", stairs: "h-3 grid-cols-[repeat(5,3px)] gap-[1.5px]" },
  lg: {
    level: "gap-2.5 text-title font-extrabold tracking-[-0.02em]",
    stairs: "h-6 grid-cols-[repeat(5,6px)] gap-[3px]",
  },
};

// A level takes its source's colour: tested results the channel, an AI judgement graphite, the person's own ink.
function sourceColour(source: Provenance | undefined): string {
  switch (source) {
    case "demonstrated":
      return "text-src-demo";
    case "ai-correlated":
      return "text-src-demo rounded-sm border border-dashed border-current ps-[5px] pe-1.5 py-px";
    case "ai-judged":
      return "text-src-ai";
    case "self-reported":
    case undefined:
      return "";
  }
}

/**
 * Shows a level as its name beside a five-step stair, with only the step it stands on drawn.
 *
 * @remarks The glyph says "where", not "how full", and the word always comes with it, so it never reads as a score
 * (Charter R1, the design system's levels). The stair is hidden from screen readers; the name carries the meaning.
 * An AI-correlated level carries the dashed edge and the monogram wherever it sits.
 * @param props - The level 0–4 and its name; where it came from, for its colour; whether to follow the name with the
 * number; whether it is struck through because it no longer counts; its size; and any `data-` attributes, such as
 * one that marks the level a page shows.
 * @returns The stair and the name on one line.
 */
export function Level({
  level,
  name,
  source,
  number = false,
  struck = false,
  size = "md",
  ...data
}: {
  readonly level: number;
  readonly name: string;
  readonly source?: Provenance | undefined;
  readonly number?: boolean;
  readonly struck?: boolean;
  readonly size?: LevelSize;
  readonly [attribute: `data-${string}`]: string | boolean | undefined;
}): ReactElement {
  const colour = struck ? "text-ink-3 font-normal line-through" : sourceColour(source);
  return (
    <span
      {...data}
      data-level={level}
      className={`inline-flex items-center whitespace-nowrap ${SIZES[size].level} ${colour}`}
    >
      <span aria-hidden="true" className={`inline-grid shrink-0 items-end ${SIZES[size].stairs}`}>
        {TREADS[size].map((height, step) => (
          <i
            key={height}
            data-on={step === level ? "" : undefined}
            className={`block rounded-[1px] ${height} ${step === level ? "bg-current" : "bg-current/25"}`}
          />
        ))}
      </span>
      {name}
      {/* The flex gap spaces it on screen; the space keeps "Working 2" apart for screen readers. */}
      {number ? " " : null}
      {number ? (
        <span className={`font-normal text-ink-3 ${size === "lg" ? "text-body tracking-normal" : ""}`}>
          {level}
        </span>
      ) : null}
      {source === "ai-correlated" && !struck ? <AiMark /> : null}
    </span>
  );
}
