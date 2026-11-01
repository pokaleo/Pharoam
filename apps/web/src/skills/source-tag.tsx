/**
 * The label that says where a level came from.
 *
 * @packageDocumentation
 */
import type { Provenance } from "@pharoam/core";
import { PencilRuler, UserRound, type LucideIcon } from "lucide-react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { AiMark } from "../ui/ai-mark.tsx";
import { Tag } from "../ui/tag.tsx";
import { sourceName } from "./labels.ts";

// Tested results carry the ruler; the person's own claim the person; an AI judgement only the monogram.
const ICONS: Record<Provenance, LucideIcon | undefined> = {
  "self-reported": UserRound,
  "ai-judged": undefined,
  demonstrated: PencilRuler,
  "ai-correlated": PencilRuler,
};

/**
 * One of the four source labels, with its icon and the design system's fixed word.
 *
 * @remarks Tested results (demonstrated, AI correlated) take the channel; untested claims (self-reported, AI
 * judgement) stay neutral. AI-made sources add the monogram and a dashed edge, so an AI-correlated result never looks
 * like a demonstrated one (PRD C4, the design system's sources).
 * @param props - Where the level came from.
 * @returns A tag with the source's icon, mark and word.
 */
export function SourceTag({ provenance }: { readonly provenance: Provenance }): ReactElement {
  const { t } = useTranslation();
  const ai = provenance === "ai-judged" || provenance === "ai-correlated";
  return (
    <Tag tone={provenance} icon={ICONS[provenance]} mark={ai ? <AiMark /> : undefined}>
      {sourceName(t, provenance)}
    </Tag>
  );
}
