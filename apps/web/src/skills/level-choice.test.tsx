import type { ContentPack } from "@pharoam/core";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { loadContentPack } from "../content.ts";
import { createI18n } from "../i18n.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";
import { LevelChoice } from "./level-choice.tsx";

let pack: ContentPack;
beforeAll(async () => {
  pack = await loadContentPack();
});

function renderChoice(props: Partial<Parameters<typeof LevelChoice>[0]> = {}) {
  const onChange = props.onChange ?? vi.fn();
  const { container } = render(
    <I18nextProvider i18n={createI18n()}>
      <LevelChoice content={pack} skill={undefined} value={undefined} onChange={onChange} {...props} />
    </I18nextProvider>,
  );
  return { onChange, container };
}

describe("LevelChoice (MVP S6.3, S6.5)", () => {
  it("offers the five levels by name and number, each with the shared description", async () => {
    const { container } = renderChoice();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
    screen.getByRole("radio", { name: /^Aware 0/ });
    screen.getByRole("radio", { name: /^Expert 4/ });
    screen.getByText(pack.levels.levels[3].description);
    await expectNoAxeViolations(container);
  });

  it("uses the skill's own description of a level where the content has one", () => {
    const python = pack.skills.find((skill) => skill.slug === "python");
    renderChoice({ skill: python });
    screen.getByText(python?.levels?.[3] ?? "missing");
    expect(screen.queryByText(pack.levels.levels[3].description)).toBeNull();
  });

  it("reports the level chosen", async () => {
    const { onChange } = renderChoice();
    await userEvent.setup().click(screen.getByRole("radio", { name: /^Working/ }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("shows what to fix", () => {
    renderChoice({ error: "Choose a level." });
    screen.getByText("Choose a level.");
  });
});
