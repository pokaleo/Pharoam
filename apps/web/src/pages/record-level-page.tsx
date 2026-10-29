/**
 * Recording the person's own level for a skill (MVP S6).
 *
 * @packageDocumentation
 */
import type { ContentPack, CoreService } from "@pharoam/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useId, useState, type ReactElement, type SubmitEvent } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../profile/session.tsx";
import { findSkill, skillChoices, skillName } from "../profile/skills.ts";
import { LevelChoice } from "../skills/level-choice.tsx";
import { Button } from "../ui/button.tsx";
import { TextField } from "../ui/field.tsx";
import { Notice } from "../ui/notice.tsx";
import { PageTitle } from "../ui/page-title.tsx";

/**
 * The form for a level: the skill, the level with what each one means, and any evidence it rests on.
 *
 * @remarks The level is always recorded as `self-reported`, and the form says that citing evidence doesn't test it
 * (MVP S6.2, S6.5). It is appended to the skill's record, which is started if needed (MVP S6.1).
 * @param props - The open profile's service, and the skill to start with, by slug.
 * @returns The form, once the content pack has loaded.
 */
export function RecordLevelPage({
  service,
  skill,
}: {
  readonly service: CoreService;
  readonly skill: string | undefined;
}): ReactElement | null {
  const { services } = useSession();
  const content = useQuery({ queryKey: ["content"], queryFn: services.content, staleTime: Infinity });
  if (content.data === undefined) return null;
  return <RecordLevelForm service={service} content={content.data} start={skill} />;
}

function RecordLevelForm({
  service,
  content,
  start,
}: {
  readonly service: CoreService;
  readonly content: ContentPack;
  readonly start: string | undefined;
}): ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  const navigate = useNavigate();
  const { changed } = useSession();
  const choices = skillChoices(content, service.records());
  const [typed, setTyped] = useState(start === undefined ? "" : skillName(choices, start));
  const [level, setLevel] = useState<number | undefined>(undefined);
  const [cited, setCited] = useState<readonly string[]>([]);
  const [errors, setErrors] = useState<{ skill?: boolean; level?: boolean }>({});
  const listId = useId();
  const picked = findSkill(choices, typed);
  const entry = content.skills.find((s) => s.slug === picked?.slug);
  const evidence = service
    .records()
    .flatMap(({ record }) => (record.schema === "evidence/1" ? [record] : []));

  const save = useMutation({
    mutationFn: async (rating: { skill: string; level: number; evidence: readonly string[] }) => {
      const recorded = await service.recordLevel(rating);
      changed();
      if (recorded.ok) await navigate({ to: "/skills/$skill", params: { skill: rating.skill } });
      return recorded.ok;
    },
  });

  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setErrors({ skill: picked === undefined, level: level === undefined });
    if (picked === undefined || level === undefined) return;
    save.mutate({ skill: picked.slug, level, evidence: cited });
  };

  return (
    <>
      <PageTitle title={t("skills.recordPage.title")} lead={t("skills.recordPage.lead")} titleId={titleId} />
      <form
        aria-labelledby={titleId}
        onSubmit={submit}
        noValidate
        className="grid max-w-[72ch] gap-(--space-5)"
      >
        <p className="rounded-lg bg-panel p-(--pad)">{t("skills.recordPage.own")}</p>
        <TextField
          label={t("skills.recordPage.skill")}
          hint={t("skills.recordPage.skillHint")}
          error={
            errors.skill === true && picked === undefined ? t("skills.recordPage.errors.skill") : undefined
          }
          list={listId}
          value={typed}
          onChange={(event) => {
            setTyped(event.currentTarget.value);
          }}
        />
        <datalist id={listId}>
          {choices.map((choice) => (
            <option key={choice.slug} value={choice.name} />
          ))}
        </datalist>
        <LevelChoice
          content={content}
          skill={entry}
          value={level}
          onChange={setLevel}
          error={
            errors.level === true && level === undefined ? t("skills.recordPage.errors.level") : undefined
          }
        />
        <fieldset className="grid gap-(--space-2)">
          <legend className="mb-(--space-1) font-semibold">{t("skills.recordPage.evidence")}</legend>
          {evidence.length === 0 ? <p className="text-ink-2">{t("skills.recordPage.noEvidence")}</p> : null}
          {evidence.map((record) => (
            <label key={record.id} className="flex items-center gap-(--space-2)">
              <input
                type="checkbox"
                checked={cited.includes(record.id)}
                onChange={(event) => {
                  const on = event.currentTarget.checked;
                  setCited((now) => (on ? [...now, record.id] : now.filter((id) => id !== record.id)));
                }}
                className="size-4 accent-(--primary)"
              />
              {record.title}
            </label>
          ))}
        </fieldset>
        {save.data === false || save.isError ? (
          <Notice tone="problem" title={t("skills.recordPage.failed")} />
        ) : null}
        <div>
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {t("skills.recordPage.submit")}
          </Button>
        </div>
      </form>
    </>
  );
}
