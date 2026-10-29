/**
 * Editing a piece of evidence (MVP S5.1).
 *
 * @packageDocumentation
 */
import type { CoreService, EvidenceForm, LoadedRecord } from "@pharoam/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useId, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  answersOf,
  evidenceFormFrom,
  fieldErrorsOf,
  type EvidenceAnswers,
  type FieldErrors,
} from "../evidence/answers.ts";
import { EvidenceFormView } from "../evidence/evidence-form-view.tsx";
import { useSession } from "../profile/session.tsx";
import { skillChoices } from "../profile/skills.ts";
import { Button, buttonClassName } from "../ui/button.tsx";
import { ChangedOutsideNotice } from "../ui/changed-outside.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";

/** How a save ended, when it didn't. */
type Failure = "changed-outside" | "failed";

/**
 * The evidence form, filled from the stored record; saving rewrites the file.
 *
 * @remarks The file keeps its ID, creation time and fields Pharoam doesn't know, and gets a new `updated` time; it is
 * never written over a version changed in the folder since it was read (AD10).
 * @param props - The open profile's service and the evidence's ID.
 * @returns The form, or a note when the evidence can't be edited here.
 */
export function EditEvidencePage({
  service,
  id,
}: {
  readonly service: CoreService;
  readonly id: string;
}): ReactElement {
  const { t } = useTranslation();
  const loaded = service.find(id);
  const answers = loaded === undefined ? undefined : answersOf(loaded.file);
  if (loaded === undefined || answers === undefined || loaded.record.schema !== "evidence/1") {
    return (
      <>
        <PageTitle
          title={t("evidence.title")}
          lead={t(loaded === undefined ? "evidence.page.missing" : "evidence.page.notEditable")}
        />
        <Link to="/evidence" className="text-channel underline">
          {t("evidence.page.back")}
        </Link>
      </>
    );
  }
  return <EditForm service={service} loaded={loaded} title={loaded.record.title} initial={answers} id={id} />;
}

function EditForm({
  service,
  loaded,
  title,
  initial,
  id,
}: {
  readonly service: CoreService;
  readonly loaded: LoadedRecord;
  readonly title: string;
  readonly initial: EvidenceAnswers;
  readonly id: string;
}): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  const navigate = useNavigate();
  const { services, changed } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  const [answers, setAnswers] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});

  const save = useMutation({
    mutationFn: async (form: EvidenceForm): Promise<Failure | undefined> => {
      const edited = await service.editEvidence(loaded.location, form);
      changed();
      if (edited.ok) {
        await navigate({ to: "/evidence/$id", params: { id } });
        return undefined;
      }
      return edited.error.kind === "conflict" ? "changed-outside" : "failed";
    },
  });

  const submit = (): void => {
    const read = evidenceFormFrom(answers);
    if ("errors" in read) {
      setErrors(read.errors);
      return;
    }
    // The draft runs the same checks as the save, so problems show by their fields before anything is written.
    const checked = service.draftEvidence(read.form);
    if (!checked.ok) {
      setErrors(fieldErrorsOf(checked.error));
      return;
    }
    setErrors({});
    save.mutate(read.form);
  };

  return (
    <>
      <PageTitle title={t("evidence.editTitle", { title })} lead={t("evidence.editLead")} titleId={titleId} />
      <EvidenceFormView
        labelledBy={titleId}
        answers={answers}
        onChange={setAnswers}
        errors={errors}
        skills={content.data === undefined ? [] : skillChoices(content.data, service.records())}
        onSubmit={submit}
      >
        {save.data === "changed-outside" ? (
          <ChangedOutsideNotice
            title={t("evidence.changedOutside.title")}
            text={t("evidence.changedOutside.text")}
          />
        ) : save.data === "failed" || save.isError ? (
          <Notice tone="problem" title={t("evidence.saveFailed")} />
        ) : null}
        <div className="flex flex-wrap gap-(--space-2)">
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {t("evidence.saveChanges")}
          </Button>
          <Link to="/evidence/$id" params={{ id }} className={buttonClassName("secondary")}>
            {t("evidence.cancel")}
          </Link>
        </div>
      </EvidenceFormView>
    </>
  );
}
