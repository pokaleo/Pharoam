import { screen, within } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fullProfile, OBSERVATION_ID, openProfile, SQL, SQL_OBSERVATION } from "../__fixtures__/profiles.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

async function openSql(user: UserEvent, memory = fullProfile()) {
  const rendered = await openProfile(user, memory, "Skills");
  await user.click(await screen.findByRole("link", { name: "SQL" }));
  await screen.findByRole("heading", { level: 1, name: "SQL" });
  return { memory, ...rendered };
}

describe("SkillPage (MVP S7)", () => {
  it("shows the skill's one level and where it came from (MVP S9.1)", async () => {
    const user = userEvent.setup();
    const { container } = await openSql(user);

    screen.getByText(/Working/, { selector: "[data-shown-level]" });
    screen.getByText("Self-reported · since 3 Oct 2026");
    await expectNoAxeViolations(container);
  });

  it("appends a correction that supersedes the old level, leaving it as written (S7.1)", async () => {
    const user = userEvent.setup();
    const { memory } = await openSql(user);

    await user.click(screen.getByRole("button", { name: "Correct Working, 3 Oct 2026" }));
    await user.click(screen.getByRole("radio", { name: /^Beginner/ }));
    await user.click(screen.getByRole("button", { name: "Save the correction" }));

    await screen.findByText(/Beginner/, { selector: "[data-shown-level]" });
    const text = (await memory.readOutside(SQL)) ?? "";
    expect(text).toContain(SQL_OBSERVATION(2, true));
    expect(text).toContain(`supersedes: ${OBSERVATION_ID}`);
  });

  it("appends a retraction, so the level stops counting (S7.2)", async () => {
    const user = userEvent.setup();
    const { memory, container } = await openSql(user);

    await user.click(screen.getByRole("button", { name: "Retract Working, 3 Oct 2026" }));
    await user.type(screen.getByLabelText(/Why/), "Rated too high");
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole("button", { name: "Retract it" }));

    await screen.findByText("No level counts for this skill now.");
    const text = (await memory.readOutside(SQL)) ?? "";
    expect(text).toContain(SQL_OBSERVATION(2, true));
    expect(text).toMatch(new RegExp(`target: ${OBSERVATION_ID}\\n\\s+decision: retract`));
    expect(text).toContain("note: Rated too high");
  });

  it("shows every entry newest first, marking corrected, shown and hand-edited ones (S7.3, S12.3)", async () => {
    const user = userEvent.setup();
    const { container } = await openSql(user);
    await user.click(screen.getByRole("button", { name: "Correct Working, 3 Oct 2026" }));
    await user.click(screen.getByRole("radio", { name: /^Proficient/ }));
    await user.click(screen.getByRole("button", { name: "Save the correction" }));
    await screen.findByText(/Proficient/, { selector: "[data-shown-level]" });

    const history = screen.getByRole("list", { name: "Skill history" });
    const [newest, older] = within(history).getAllByRole("listitem");
    if (newest === undefined || older === undefined) throw new Error("expected two entries");
    within(newest).getByText("Proficient");
    within(newest).getByText("Shown");
    within(older).getByText("Working");
    within(older).getByText("Corrected");
    within(older).getByText(/Cites Payments API/);
    // Written by hand in the test's file, without Pharoam's fingerprint.
    within(older).getByText("Edited outside Pharoam");
    // A corrected level no longer counts, so there is nothing to correct or retract on it.
    expect(within(older).queryByRole("button")).toBeNull();
    await expectNoAxeViolations(container);
  });
});
