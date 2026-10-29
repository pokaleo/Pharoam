import { screen, within } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fileContaining, fullProfile, openProfile } from "../__fixtures__/profiles.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

async function addSkill(user: UserEvent, name: string, description?: string) {
  await user.click(await screen.findByRole("link", { name: "Add your own skill" }));
  await user.type(await screen.findByLabelText("Name"), name);
  if (description !== undefined) await user.type(screen.getByLabelText(/What it covers/), description);
  await user.click(screen.getByRole("button", { name: "Add the skill" }));
}

describe("CustomSkillPage (MVP S8)", () => {
  it("adds a custom skill, marked as the person's own everywhere, that takes levels like any other (S8.1, S8.2)", async () => {
    const user = userEvent.setup();
    const memory = fullProfile();
    const { container } = await openProfile(user, memory, "Skills");
    await user.click(await screen.findByRole("link", { name: "Add your own skill" }));
    await screen.findByRole("heading", { level: 1, name: "Add your own skill" });
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole("link", { name: "Skills" }));

    await addSkill(user, "Kdb+", "Time-series database and the q language.");

    await screen.findByRole("heading", { level: 1, name: "Kdb+" });
    screen.getByText("Your own skill");
    const text = await fileContaining(memory, "skill: custom-kdb");
    expect(text).toContain("name: Kdb+");
    expect(text).toContain("description: Time-series database and the q language.");

    await user.click(screen.getByRole("link", { name: "Record a level" }));
    expect(screen.getByLabelText<HTMLInputElement>("Skill").value).toBe("Kdb+");
    await user.click(screen.getByRole("radio", { name: /^Working/ }));
    await user.click(screen.getByRole("button", { name: "Record my level" }));
    await screen.findByText(/Working/, { selector: "[data-shown-level]" });

    await user.click(screen.getByRole("link", { name: "Skills" }));
    within(await screen.findByRole("row", { name: /Kdb\+/ })).getByText("Your own skill");
  });

  it("refuses a name already used, pointing to that skill", async () => {
    const user = userEvent.setup();
    await openProfile(user, fullProfile(), "Skills");
    await addSkill(user, "Kdb+");
    await screen.findByRole("heading", { level: 1, name: "Kdb+" });
    await user.click(screen.getByRole("link", { name: "Skills" }));

    await addSkill(user, "KDB+");

    await screen.findByText("You already have a skill called Kdb+.");
    screen.getByRole("link", { name: "Open Kdb+" });
  });

  it("asks for a name before adding anything", async () => {
    const user = userEvent.setup();
    const memory = fullProfile();
    await openProfile(user, memory, "Skills");
    await user.click(await screen.findByRole("link", { name: "Add your own skill" }));

    await user.click(await screen.findByRole("button", { name: "Add the skill" }));

    screen.getByText("Give the skill a name.");
    expect(memory.writes()).toBe(0);
  });
});
