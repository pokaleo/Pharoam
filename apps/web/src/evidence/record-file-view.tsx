/**
 * A record shown as the file it is, or will be, stored as.
 *
 * @packageDocumentation
 */
import { printRecordFile, type RecordFile } from "@pharoam/core";
import { FileCode } from "lucide-react";
import { useId, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../ui/icon.tsx";

/**
 * The design system's file view: the Markdown and YAML behind a record, under a bar that names it (MVP S4.2).
 *
 * @remarks The text is printed by the same code that writes the file, so it is exactly what will be stored, and it is
 * shown as text, never rendered (hard rule 10).
 * @param props - The record to show, as a file, and, where several are shown together, the ID of the element
 * that names this one, so each region has its own name.
 * @returns The file view, a region named by its bar.
 */
export function RecordFileView({
  file,
  namedBy,
}: {
  readonly file: RecordFile;
  readonly namedBy?: string;
}): ReactElement {
  const { t } = useTranslation();
  const barId = useId();
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <p
        id={barId}
        className="flex items-center gap-(--space-2) border-b border-line bg-panel px-3 py-2 text-meta text-ink-2"
      >
        <Icon of={FileCode} size="sm" />
        {t("evidence.preview.file")}
      </p>
      <pre
        role="region"
        aria-labelledby={namedBy === undefined ? barId : `${barId} ${namedBy}`}
        className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-5 whitespace-pre-wrap text-ink [direction:ltr] [text-align:left]"
      >
        {printRecordFile(file)}
      </pre>
    </div>
  );
}
