/**
 * The evidence form: the kind first, then the common fields and the kind's own (MVP S4.1).
 *
 * @packageDocumentation
 */
import {
  EVIDENCE_FORM_KINDS,
  evidenceFormFields,
  type EvidenceFormField,
  type EvidenceFormKind,
} from "@pharoam/core";
import { useId, useState, type ReactElement, type ReactNode, type SubmitEvent } from "react";
import { useTranslation } from "react-i18next";
import { findSkill, skillName, type SkillChoice } from "../profile/skills.ts";
import { Button } from "../ui/button.tsx";
import { TextAreaField, TextField } from "../ui/field.tsx";
import type { EvidenceAnswers, FieldErrors, TextAnswer } from "./answers.ts";

/**
 * The evidence form, controlled by the page so its answers survive going to the preview and back.
 *
 * @remarks Switching kinds keeps every answer; the core leaves out those the chosen kind doesn't have.
 * @param props - The answers and their setter, the fields to fix, the skills to pick from, what submitting does,
 * the form's accessible name, and the buttons that end it.
 * @returns The kind's fields, in order, followed by the buttons given.
 */
export function EvidenceFormView({
  answers,
  onChange,
  errors,
  skills,
  onSubmit,
  labelledBy,
  children,
}: {
  readonly answers: EvidenceAnswers;
  readonly onChange: (answers: EvidenceAnswers) => void;
  readonly errors: FieldErrors;
  readonly skills: readonly SkillChoice[];
  readonly onSubmit: () => void;
  readonly labelledBy: string;
  readonly children: ReactNode;
}): ReactElement {
  const { t } = useTranslation();
  const fields = evidenceFormFields(answers.kind);
  const error = (field: EvidenceFormField): string | undefined => {
    const problem = errors[field];
    return problem === undefined ? undefined : t(`evidence.errors.${problem}`);
  };
  const textField = (field: TextAnswer, hint?: string): ReactElement => (
    <TextField
      key={field}
      name={field}
      label={t(`evidence.fields.${field}`)}
      hint={hint}
      error={error(field)}
      value={answers.text[field] ?? ""}
      onChange={(event) => {
        onChange({ ...answers, text: { ...answers.text, [field]: event.currentTarget.value } });
      }}
    />
  );
  const dateHint = t("evidence.hints.date");

  const field = (name: EvidenceFormField): ReactNode => {
    switch (name) {
      case "title":
        return textField("title", t(`evidence.hints.title`));
      case "organisation":
        return textField("organisation", t("evidence.hints.organisation"));
      case "date":
        return textField("date", t("evidence.hints.dateOne"));
      case "start":
      case "end":
      case "expires":
        return textField(name, dateHint);
      case "links":
        return (
          <TextAreaField
            key={name}
            name={name}
            label={t("evidence.fields.links")}
            hint={t("evidence.hints.links")}
            error={error(name)}
            rows={2}
            value={answers.links}
            onChange={(event) => {
              onChange({ ...answers, links: event.currentTarget.value });
            }}
          />
        );
      case "skills":
        return (
          <SkillPicker
            key={name}
            picked={answers.skills}
            skills={skills}
            onChange={(picked) => {
              onChange({ ...answers, skills: picked });
            }}
          />
        );
      case "description":
        return (
          <TextAreaField
            key={name}
            name={name}
            label={t("evidence.fields.description")}
            hint={t("evidence.hints.description")}
            error={error(name)}
            rows={6}
            value={answers.description}
            onChange={(event) => {
              onChange({ ...answers, description: event.currentTarget.value });
            }}
          />
        );
      case "role":
      case "course_code":
      case "credits":
      case "grade":
      case "issuer":
      case "credential_id":
        return textField(name);
    }
  };

  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      aria-labelledby={labelledBy}
      onSubmit={submit}
      noValidate
      className="grid max-w-[72ch] gap-(--space-5)"
    >
      <fieldset className="grid gap-(--space-2)">
        <legend className="mb-(--space-1) font-semibold">{t("evidence.kindQuestion")}</legend>
        <div className="flex flex-wrap gap-x-(--space-4) gap-y-(--space-2)">
          {EVIDENCE_FORM_KINDS.map((kind: EvidenceFormKind) => (
            <label key={kind} className="flex items-center gap-(--space-2)">
              <input
                type="radio"
                name="kind"
                value={kind}
                checked={answers.kind === kind}
                onChange={() => {
                  onChange({ ...answers, kind });
                }}
                className="size-4 accent-(--primary)"
              />
              {t(`evidence.kinds.${kind}`)}
            </label>
          ))}
        </div>
      </fieldset>
      {fields.map(field)}
      {children}
    </form>
  );
}

// Picks skills from the vocabulary and the person's own, by name, as chips that can be removed (MVP S4.6).
function SkillPicker({
  picked,
  skills,
  onChange,
}: {
  readonly picked: readonly string[];
  readonly skills: readonly SkillChoice[];
  readonly onChange: (picked: readonly string[]) => void;
}): ReactElement {
  const { t } = useTranslation();
  const listId = useId();
  const [typed, setTyped] = useState("");
  const [notFound, setNotFound] = useState<string | undefined>(undefined);

  const add = (): void => {
    const skill = findSkill(skills, typed);
    if (skill === undefined) {
      setNotFound(typed.trim());
      return;
    }
    setNotFound(undefined);
    setTyped("");
    if (!picked.includes(skill.slug)) onChange([...picked, skill.slug]);
  };

  return (
    <fieldset className="grid gap-(--space-2)">
      <legend className="mb-(--space-1) font-semibold">{t("evidence.fields.skills")}</legend>
      {picked.length === 0 ? null : (
        <ul aria-label={t("evidence.skillsPicked")} className="flex flex-wrap gap-(--space-2)">
          {picked.map((slug) => {
            const name = skillName(skills, slug);
            return (
              <li key={slug} className="flex items-center gap-1 rounded-sm bg-panel ps-2 text-meta">
                {name}
                <Button
                  variant="quiet"
                  className="min-h-6 px-1"
                  aria-label={t("evidence.removeSkill", { skill: name })}
                  onClick={() => {
                    onChange(picked.filter((p) => p !== slug));
                  }}
                >
                  ×
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex max-w-[56ch] flex-wrap items-end gap-(--space-2)">
        <div className="min-w-48 flex-1">
          <TextField
            label={t("evidence.findSkill")}
            error={
              notFound === undefined ? undefined : t("evidence.errors.unknownSkill", { skill: notFound })
            }
            list={listId}
            value={typed}
            onChange={(event) => {
              setTyped(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
          />
        </div>
        <Button onClick={add}>{t("evidence.addSkill")}</Button>
      </div>
      <datalist id={listId}>
        {skills.map((skill) => (
          <option key={skill.slug} value={skill.name} />
        ))}
      </datalist>
    </fieldset>
  );
}
