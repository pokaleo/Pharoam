/**
 * Choosing a level 0–4, with what each level means.
 *
 * @packageDocumentation
 */
import { levelDescriptions, type ContentPack, type SkillEntry } from "@pharoam/core";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

/**
 * The five levels as a choice, each with its name, number and description (MVP S6.3).
 *
 * @remarks Uses the skill's own description of a level where the content has one, and the shared one otherwise.
 * There is no choice of source: a level chosen here is always the person's own rating (MVP S6.5).
 * @param props - The content pack, the skill when it is in the vocabulary, the level chosen, what choosing does,
 * and an error to show.
 * @returns The labelled group of levels.
 */
export function LevelChoice({
  content,
  skill,
  value,
  onChange,
  error,
}: {
  readonly content: ContentPack;
  readonly skill: SkillEntry | undefined;
  readonly value: number | undefined;
  readonly onChange: (level: number) => void;
  readonly error?: string | undefined;
}): ReactElement {
  const { t } = useTranslation();
  return (
    <fieldset className="grid gap-(--space-2)" aria-invalid={error === undefined ? undefined : true}>
      <legend className="mb-(--space-1) font-semibold">{t("skills.level")}</legend>
      {error === undefined ? null : <p className="text-meta font-semibold text-problem">{error}</p>}
      {levelDescriptions(content.levels, skill).map((level) => (
        <label
          key={level.level}
          className="grid grid-cols-[auto_1fr] gap-x-(--space-2) rounded-md border border-line bg-surface p-(--space-2) has-checked:border-ink"
        >
          <input
            type="radio"
            name="level"
            value={level.level}
            checked={value === level.level}
            onChange={() => {
              onChange(level.level);
            }}
            className="mt-1 size-4 accent-(--primary)"
          />
          <span>
            <span className="font-semibold">{level.name}</span>{" "}
            <span className="text-ink-3">{level.level}</span>
          </span>
          <span className="col-start-2 text-meta text-ink-2">{level.description}</span>
        </label>
      ))}
    </fieldset>
  );
}
