/**
 * Choosing a level 0–4, with what each level means.
 *
 * @packageDocumentation
 */
import { levelDescriptions, type ContentPack, type SkillEntry } from "@pharoam/core";
import { CircleAlert } from "lucide-react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../ui/icon.tsx";
import { Level } from "./level.tsx";

/**
 * The five levels as a choice, each with its name, number, stair and description (MVP S6.3).
 *
 * @remarks The design system's level picker: five named steps side by side, one column under 768px. Uses the skill's
 * own description of a level where the content has one, and the shared one otherwise. There is no choice of source:
 * a level chosen here is always the person's own rating (MVP S6.5).
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
    <fieldset aria-invalid={error === undefined ? undefined : true}>
      <legend className="mb-2 font-semibold">{t("skills.level")}</legend>
      {error === undefined ? null : (
        <p className="mb-2 flex items-center gap-1.5 text-meta text-problem">
          <Icon of={CircleAlert} size="sm" />
          {error}
        </p>
      )}
      <div className="grid gap-1 md:grid-cols-5">
        {levelDescriptions(content.levels, skill).map((level) => (
          <label
            key={level.level}
            className="relative grid cursor-pointer content-start gap-1 rounded-md border border-line-strong bg-surface p-2.5 transition-[border-color,background-color] duration-(--dur-feedback) ease-(--ease) hover:border-ink-2 has-checked:border-2 has-checked:border-ink has-checked:bg-panel has-checked:p-[9px] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus) max-md:grid-cols-[auto_1fr] max-md:items-center max-md:gap-x-3 md:min-h-[76px]"
          >
            <input
              type="radio"
              name="level"
              value={level.level}
              checked={value === level.level}
              onChange={() => {
                onChange(level.level);
              }}
              className="absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0"
            />
            <Level level={level.level} name={level.name} number />
            <span className="text-meta font-normal text-ink-2 max-md:col-start-2">{level.description}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
