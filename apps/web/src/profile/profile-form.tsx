/**
 * The form for the fields of `pharoam.md`: headline, situation, country and focus.
 *
 * @packageDocumentation
 */
import { pathwaySummaries, type ProfileFields } from "@pharoam/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactElement, type ReactNode, type SubmitEvent } from "react";
import { useTranslation } from "react-i18next";
import { SelectField, TextField } from "../ui/field.tsx";
import { isStage, profileFieldsOf, STAGES, type Stage } from "./profile-fields.ts";
import { regionOptions } from "./regions.ts";
import { useSession } from "./session.tsx";

/**
 * The profile form, filled with the current fields when there are any.
 *
 * @remarks Every field is optional. There is no field for a name, photo, contact details or exact location: the
 * country is the most precise place the profile holds (MVP S1.2, hard rule 8).
 * @param props - The ID of the heading that names the form, the fields to start from, what saving does, and the
 * notices and buttons that end the form.
 * @returns The labelled fields, followed by the notices and buttons given.
 */
export function ProfileForm({
  labelledBy,
  initial = {},
  onSubmit,
  children,
}: {
  readonly labelledBy: string;
  readonly initial?: ProfileFields;
  readonly onSubmit: (fields: ProfileFields) => void;
  readonly children: ReactNode;
}): ReactElement {
  const { t } = useTranslation();
  const { services } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  const regions = useMemo(() => regionOptions(t("app.locale")), [t]);
  const [stage, setStage] = useState<Stage | "">(initial.situation?.stage ?? "");
  const focus = initial.focus?.pathways ?? [];

  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSubmit(profileFieldsOf(new FormData(event.currentTarget)));
  };

  return (
    <form aria-labelledby={labelledBy} onSubmit={submit} className="grid gap-(--space-5)">
      <p className="max-w-[72ch] text-ink-2">{t("createProfile.optional")}</p>
      <TextField
        name="headline"
        label={t("createProfile.headline")}
        hint={t("createProfile.headlineHint")}
        defaultValue={initial.headline ?? ""}
      />
      <SelectField
        name="stage"
        label={t("createProfile.stage")}
        value={stage}
        onChange={(event) => {
          const value = event.currentTarget.value;
          setStage(isStage(value) ? value : "");
        }}
        options={[
          { value: "", label: t("createProfile.stageNone") },
          ...STAGES.map((value) => ({ value, label: t(`createProfile.stages.${value}`) })),
        ]}
      />
      <TextField
        name="field"
        label={t("createProfile.field")}
        disabled={stage === ""}
        defaultValue={initial.situation?.field ?? ""}
      />
      <SelectField
        name="region"
        label={t("createProfile.region")}
        defaultValue={initial.region ?? ""}
        options={[
          { value: "", label: t("createProfile.regionNone") },
          ...regions.map((region) => ({ value: region.code, label: region.name })),
        ]}
      />
      <fieldset className="grid gap-(--space-2)">
        <legend className="mb-(--space-1) font-semibold">{t("createProfile.focus")}</legend>
        {(content.data === undefined ? [] : pathwaySummaries(content.data)).map((pathway) => (
          <label key={pathway.slug} className="flex items-center gap-(--space-2)">
            <input
              type="checkbox"
              name="pathways"
              value={pathway.slug}
              defaultChecked={focus.includes(pathway.slug)}
              className="size-4 accent-(--primary)"
            />
            {pathway.title}
          </label>
        ))}
      </fieldset>
      {children}
    </form>
  );
}
