/**
 * Where a pathway came from, in one strip above what it asks for.
 *
 * @packageDocumentation
 */
import type { PathwayDetail } from "@pharoam/core";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { dayName } from "../skills/labels.ts";
import { AiMark } from "../ui/ai-mark.tsx";
import { Tag } from "../ui/tag.tsx";

/**
 * Says who reviewed a pathway and when, and, when AI drafted it, which model did.
 *
 * @remarks The design system's provenance strip, on the pathway and its gap (MVP S10.2, S10.3, PRD D6, I3).
 * @param props - The pathway's review and AI provenance.
 * @returns The strip.
 */
export function PathwayProvenance({
  pathway,
}: {
  readonly pathway: Pick<PathwayDetail, "ai" | "review">;
}): ReactElement {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-panel px-(--pad) py-2.5 text-meta text-ink-2">
      {pathway.ai === null ? null : (
        <>
          <Tag tone="ai-judged" mark={<AiMark />}>
            {t("pathways.aiMark")}
          </Tag>
          <span>{t("pathways.aiDrafted", { model: pathway.ai.model, by: pathway.review.by })}</span>
        </>
      )}
      <span>{t("pathways.reviewed", { by: pathway.review.by, date: dayName(t, pathway.review.at) })}</span>
    </div>
  );
}
