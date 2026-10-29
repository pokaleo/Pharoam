/**
 * Recording a new piece of evidence: the form, then a preview, then the save (MVP S4).
 *
 * @packageDocumentation
 */
import { printRecordFile, type CoreService, type RecordFile } from "@pharoam/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  evidenceFormFrom,
  fieldErrorsOf,
  NO_ANSWERS,
  type EvidenceAnswers,
  type FieldErrors,
} from "../evidence/answers.ts";
import { EvidenceFormView } from "../evidence/evidence-form-view.tsx";
import { useSession } from "../profile/session.tsx";
import { skillChoices } from "../profile/skills.ts";
import { Button } from "../ui/button.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";

/**
 * The evidence form; continuing shows the record exactly as it will be stored, and only saving writes it.
 *
 * @remarks The preview is the file's text, printed by the same code that writes it (MVP S4.2). Saving writes one file
 * to `evidence/` with a new ID, `source: manual` and `ai: null` (MVP S4.3).
 * @param props - The open profile's service.
 * @returns The form, or the preview with its save and back buttons.
 */
export function NewEvidencePage({ service }: { readonly service: CoreService }): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  const navigate = useNavigate();
  const { services, changed } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  const [answers, setAnswers] = useState<EvidenceAnswers>(NO_ANSWERS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [draft, setDraft] = useState<RecordFile | undefined>(undefined);

  const save = useMutation({
    mutationFn: async (file: RecordFile) => {
      const created = await service.create(file);
      changed();
      if (created.ok && created.value.record.schema === "evidence/1") {
        await navigate({ to: "/evidence/$id", params: { id: created.value.record.id } });
      }
      return created.ok;
    },
  });

  const toPreview = (): void => {
    const read = evidenceFormFrom(answers);
    if ("errors" in read) {
      setErrors(read.errors);
      return;
    }
    const drafted = service.draftEvidence(read.form);
    if (!drafted.ok) {
      setErrors(fieldErrorsOf(drafted.error));
      return;
    }
    setErrors({});
    setDraft(drafted.value);
  };

  if (draft !== undefined) {
    return (
      <Preview
        file={draft}
        saving={save.isPending}
        failed={save.data === false || save.isError}
        onSave={() => {
          save.mutate(draft);
        }}
        onBack={() => {
          setDraft(undefined);
        }}
      />
    );
  }

  return (
    <>
      <PageTitle title={t("evidence.newTitle")} lead={t("evidence.newLead")} titleId={titleId} />
      <EvidenceFormView
        labelledBy={titleId}
        answers={answers}
        onChange={setAnswers}
        errors={errors}
        skills={content.data === undefined ? [] : skillChoices(content.data, service.records())}
        onSubmit={toPreview}
      >
        <div>
          <Button type="submit" variant="primary">
            {t("evidence.continue")}
          </Button>
        </div>
      </EvidenceFormView>
    </>
  );
}

function Preview({
  file,
  saving,
  failed,
  onSave,
  onBack,
}: {
  readonly file: RecordFile;
  readonly saving: boolean;
  readonly failed: boolean;
  readonly onSave: () => void;
  readonly onBack: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  // The page changed in place, so focus moves to its new title for keyboard and screen reader users.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <>
      <div className="mb-(--space-5) grid gap-(--space-2)">
        <h1 ref={heading} tabIndex={-1} className="text-title font-extrabold tracking-[-0.025em]">
          {t("evidence.preview.title")}
        </h1>
        <p className="max-w-[72ch] text-lead text-ink-2">{t("evidence.preview.lead")}</p>
      </div>
      <div className="grid max-w-[72ch] gap-(--space-4)">
        <pre
          role="region"
          aria-label={t("evidence.preview.file")}
          className="rounded-lg border border-line bg-surface p-(--pad) font-mono text-meta whitespace-pre-wrap"
        >
          {printRecordFile(file)}
        </pre>
        {failed ? <Notice tone="problem" title={t("evidence.saveFailed")} /> : null}
        <div className="flex flex-wrap gap-(--space-2)">
          <Button variant="primary" disabled={saving} onClick={onSave}>
            {t("evidence.preview.save")}
          </Button>
          <Button disabled={saving} onClick={onBack}>
            {t("evidence.preview.back")}
          </Button>
        </div>
      </div>
    </>
  );
}
