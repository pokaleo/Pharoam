import { act, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { emptyProfile, fullProfile, openProfile, navLink } from "../__fixtures__/profiles.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

describe("SkillsPage (MVP S9)", () => {
  it("lists each skill with one level, its source and since when (S9.1)", async () => {
    const user = userEvent.setup();
    const { container } = await openProfile(user, fullProfile(), "Skills");

    const row = await screen.findByRole("row", { name: /SQL/ });
    within(row).getByText("Working");
    within(row).getByText("Self-reported");
    within(row).getByText("since 3 Oct 2026");
    await expectNoAxeViolations(container);
  });

  it("groups the skills by domain, and counts the ones the view shows", async () => {
    const user = userEvent.setup();
    await openProfile(user, fullProfile(), "Skills");

    const sql = await screen.findByRole("row", { name: /SQL/ });
    const rows = screen.getAllByRole("row");
    const group = rows.slice(0, rows.indexOf(sql)).findLast((row) => row.dataset.group !== undefined);
    expect(group?.textContent).not.toBe("");
    await user.type(screen.getByLabelText("Search your skills"), "zzz");
    screen.getByText("0 skills");
    screen.getByText("No skills match. Try another search or domain.");
  });

  it("narrows the list by a search of names, and by domain (S9.3)", async () => {
    const user = userEvent.setup();
    await openProfile(user, fullProfile(), "Skills");
    await user.click(await screen.findByRole("link", { name: "Record a level" }));
    await user.type(await screen.findByLabelText("Skill"), "A/B testing");
    await user.click(screen.getByRole("radio", { name: /^Beginner/ }));
    await user.click(screen.getByRole("button", { name: "Record my level" }));
    await user.click(await navLink("Skills"));

    // The skills' own rows, each named by its row header; group and header rows have none.
    const skillRows = (): (string | null)[] =>
      screen
        .getAllByRole("row")
        .filter((row) => within(row).queryByRole("rowheader") !== null)
        .map((row) => row.textContent);

    await user.type(await screen.findByLabelText("Search your skills"), "sq");
    expect(skillRows()).toEqual([expect.stringContaining("SQL")]);

    await user.clear(screen.getByLabelText("Search your skills"));
    await user.selectOptions(screen.getByLabelText("Domain"), "Data and machine learning");
    expect(skillRows()).toEqual([expect.stringContaining("A/B testing")]);
  });

  it("shows the first skill's details beside the list: its level, source and file", async () => {
    const user = userEvent.setup();
    const { container } = await openProfile(user, fullProfile(), "Skills");

    const detail = await screen.findByRole("region", { name: "SQL" });
    within(detail).getByText("Working", { selector: "[data-shown-level]" });
    // The source line under the level: its label, then since when.
    expect(within(detail).getByText("since 3 Oct 2026").parentElement?.textContent).toBe(
      "Self-reportedsince 3 Oct 2026",
    );
    within(detail).getByText("skills/sql.md");
    within(detail).getByText("No evidence is linked to this skill yet.");
    within(within(detail).getByRole("list", { name: "Skill history" })).getByText("Shown");
    expect(
      within(detail).getByRole("link", { name: "See the full history (1 entry)" }).getAttribute("href"),
    ).toBe("/skills/sql");
    await expectNoAxeViolations(container);
  });

  it("shows another skill's details when its row is chosen, by pointer or by keyboard", async () => {
    const user = userEvent.setup();
    await openProfile(user, fullProfile(), "Skills");
    await user.click(await screen.findByRole("link", { name: "Record a level" }));
    await user.type(await screen.findByLabelText("Skill"), "Python");
    await user.click(screen.getByRole("radio", { name: /^Working/ }));
    await user.click(screen.getByRole("button", { name: "Record my level" }));
    await user.click(await navLink("Skills"));

    await user.click(within(await screen.findByRole("row", { name: /SQL/ })).getByText("Self-reported"));
    await screen.findByRole("region", { name: "SQL" });
    act(() => {
      screen.getByRole("link", { name: "Python" }).focus();
    });
    const python = screen.getByRole("region", { name: "Python" });
    // Evidence linked to Python, which carries no level.
    within(python).getByRole("link", { name: "Payments API" });
    within(python).getByText("1 record, no level");
    expect(screen.queryByRole("region", { name: "SQL" })).toBeNull();
  });

  it("says how to start when there are no skills yet", async () => {
    const user = userEvent.setup();
    await openProfile(user, emptyProfile(), "Skills");

    await screen.findByText(/No skills yet/);
    expect(screen.queryByRole("table")).toBeNull();
  });
});
