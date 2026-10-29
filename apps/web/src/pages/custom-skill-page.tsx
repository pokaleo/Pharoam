/**
 * Adding a skill the vocabulary is missing (MVP S8).
 *
 * @packageDocumentation
 */
import type { CoreService } from "@pharoam/core";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useId, useState, type ReactElement, type SubmitEvent } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../profile/session.tsx";
import { Button } from "../ui/button.tsx";
import { TextAreaField, TextField } from "../ui/field.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";

/** How adding ended, when it didn't. */
type Failure =
  { readonly kind: "exists"; readonly skill: string; readonly name: string } | { readonly kind: "failed" };

/**
 * The form for a custom skill: its name and what it covers.
 *
 * @remarks Starts the skill's record with a `custom-` slug; the skill is marked as the person's own wherever it
 * appears, takes levels like any other, and never matches a pathway's requirement (MVP S8.1–S8.3). A name already
 * used is refused, with a link to that skill.
 * @param props - The open profile's service.
 * @returns The form.
 */
export function CustomSkillPage({ service }: { readonly service: CoreService }): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  const navigate = useNavigate();
  const { changed } = useSession();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [missingName, setMissingName] = useState(false);

  const add = useMutation({
    mutationFn: async (): Promise<Failure | undefined> => {
      const added = await service.addCustomSkill({
        name: name.trim(),
        ...(description.trim() === "" ? {} : { description: description.trim() }),
      });
      changed();
      if (added.ok) {
        if (added.value.record.schema === "skill-record/1") {
          await navigate({ to: "/skills/$skill", params: { skill: added.value.record.skill } });
        }
        return undefined;
      }
      const error = added.error;
      if (error.kind === "skill-exists") {
        const existing = service.records().find((r) => r.location === error.location)?.record;
        const existingName = existing?.schema === "skill-record/1" ? (existing.name ?? name) : name;
        return { kind: "exists", skill: error.skill, name: existingName };
      }
      return { kind: "failed" };
    },
  });

  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setMissingName(name.trim() === "");
    if (name.trim() !== "") add.mutate();
  };

  return (
    <>
      <PageTitle title={t("skills.customPage.title")} lead={t("skills.customPage.lead")} titleId={titleId} />
      <form
        aria-labelledby={titleId}
        onSubmit={submit}
        noValidate
        className="grid max-w-[72ch] gap-(--space-5)"
      >
        <TextField
          label={t("skills.customPage.name")}
          error={missingName ? t("skills.customPage.errors.name") : undefined}
          value={name}
          onChange={(event) => {
            setName(event.currentTarget.value);
          }}
        />
        <TextAreaField
          label={t("skills.customPage.description")}
          rows={3}
          value={description}
          onChange={(event) => {
            setDescription(event.currentTarget.value);
          }}
        />
        {add.data?.kind === "exists" ? (
          <Notice tone="attention" title={t("skills.customPage.exists", { name: add.data.name })}>
            <Link to="/skills/$skill" params={{ skill: add.data.skill }} className="text-channel underline">
              {t("skills.customPage.open", { name: add.data.name })}
            </Link>
          </Notice>
        ) : add.data?.kind === "failed" || add.isError ? (
          <Notice tone="problem" title={t("skills.customPage.failed")} />
        ) : null}
        <div>
          <Button type="submit" variant="primary" disabled={add.isPending}>
            {t("skills.customPage.submit")}
          </Button>
        </div>
      </form>
    </>
  );
}
