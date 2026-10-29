import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { emptyProfile, fullProfile, openProfile } from "../__fixtures__/profiles.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

describe("SkillsPage (MVP S9)", () => {
  it("lists each skill with one level, its source and since when (S9.1)", async () => {
    const user = userEvent.setup();
    const { container } = await openProfile(user, fullProfile(), "Skills");

    const row = await screen.findByRole("row", { name: /SQL/ });
    within(row).getByText("Working");
    within(row).getByText(/Self-reported · since 3 Oct 2026/);
    await expectNoAxeViolations(container);
  });

  it("narrows the list by a search of names, and by domain (S9.3)", async () => {
    const user = userEvent.setup();
    await openProfile(user, fullProfile(), "Skills");
    await user.click(await screen.findByRole("link", { name: "Record a level" }));
    await user.type(await screen.findByLabelText("Skill"), "A/B testing");
    await user.click(screen.getByRole("radio", { name: /^Beginner/ }));
    await user.click(screen.getByRole("button", { name: "Record my level" }));
    await user.click(await screen.findByRole("link", { name: "Skills" }));

    await user.type(await screen.findByLabelText("Search your skills"), "sq");
    const searched = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.textContent);
    expect(searched).toEqual([expect.stringContaining("SQL")]);

    await user.clear(screen.getByLabelText("Search your skills"));
    await user.selectOptions(screen.getByLabelText("Domain"), "Data and machine learning");
    const filtered = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.textContent);
    expect(filtered).toEqual([expect.stringContaining("A/B testing")]);
  });

  it("says how to start when there are no skills yet", async () => {
    const user = userEvent.setup();
    await openProfile(user, emptyProfile(), "Skills");

    await screen.findByText(/No skills yet/);
    expect(screen.queryByRole("table")).toBeNull();
  });
});
