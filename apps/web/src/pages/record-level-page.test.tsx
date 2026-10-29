import { screen } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { EVIDENCE_ID, fileContaining, fullProfile, openProfile } from "../__fixtures__/profiles.ts";
import { loadContentPack } from "../content.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

async function openForm(user: UserEvent, memory = fullProfile()) {
  const rendered = await openProfile(user, memory, "Skills");
  await user.click(await screen.findByRole("link", { name: "Record a level" }));
  await screen.findByRole("heading", { level: 1, name: "Record a level" });
  return { memory, ...rendered };
}

describe("RecordLevelPage (MVP S6)", () => {
  it("appends a self-reported observation, creating the skill record, and shows it (S6.1, S6.4)", async () => {
    const user = userEvent.setup();
    const { memory, container } = await openForm(user);

    await user.type(screen.getByLabelText("Skill"), "Python");
    await user.click(screen.getByRole("radio", { name: /^Proficient/ }));
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole("button", { name: "Record my level" }));

    await screen.findByRole("heading", { level: 1, name: "Python" });
    expect(await fileContaining(memory, "skill: python\n")).toMatch(
      /level: 3\n\s+provenance: self-reported\n\s+observed_at: \S+\n\s+integrity: sha256-c1:[0-9a-f]{64}\n/,
    );
    screen.getByText(/Proficient/, { selector: "[data-shown-level]" });
  });

  it("lists cited evidence and says the level is the person's own rating, which citing doesn't test (S6.2)", async () => {
    const user = userEvent.setup();
    const { memory } = await openForm(user);

    screen.getByText(/This is your own rating\. Citing evidence doesn't test it\./);
    await user.type(screen.getByLabelText("Skill"), "Python");
    await user.click(screen.getByRole("radio", { name: /^Working/ }));
    await user.click(screen.getByRole("checkbox", { name: "Payments API" }));
    await user.click(screen.getByRole("button", { name: "Record my level" }));

    await screen.findByRole("heading", { level: 1, name: "Python" });
    expect(await fileContaining(memory, "skill: python\n")).toMatch(
      new RegExp(`evidence:\\n\\s+- ${EVIDENCE_ID}`),
    );
  });

  it("describes each level for the skill, its own description where there is one (S6.3)", async () => {
    const user = userEvent.setup();
    const pack = await loadContentPack();
    const python = pack.skills.find((skill) => skill.slug === "python");
    await openForm(user);

    screen.getByText(pack.levels.levels[2].description);
    await user.type(screen.getByLabelText("Skill"), "Python");
    screen.getByText(python?.levels?.[2] ?? "missing");
  });

  it("offers no choice of source: a level recorded by hand is always self-reported (S6.5)", async () => {
    const user = userEvent.setup();
    await openForm(user);

    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.queryByLabelText(/source|provenance/i)).toBeNull();
  });

  it("asks for a skill from the list and a level before recording anything", async () => {
    const user = userEvent.setup();
    const { memory } = await openForm(user);

    await user.type(screen.getByLabelText("Skill"), "Not a real skill");
    await user.click(screen.getByRole("button", { name: "Record my level" }));

    screen.getByText("Pick a skill from the list, or add your own skill first.");
    screen.getByText("Choose a level.");
    expect(memory.writes()).toBe(0);
  });
});
