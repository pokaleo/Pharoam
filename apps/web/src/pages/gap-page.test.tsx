import type { MemoryConnector } from "@pharoam/core/testing";
import { screen, within } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { emptyProfile, fileContaining, fullProfile, openProfile } from "../__fixtures__/profiles.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

// Opens the gap to a pathway, starting from the pathways list.
async function openGap(user: UserEvent, memory: MemoryConnector, pathway: string) {
  const rendered = await openProfile(user, memory, "Pathways");
  await user.click(await screen.findByRole("link", { name: pathway }));
  await user.click(await screen.findByRole("link", { name: "See my gap to this pathway" }));
  await screen.findByRole("heading", { level: 1, name: `Your gap to ${pathway}` });
  return rendered;
}

describe("GapPage (MVP S11)", () => {
  it("groups each requirement by the skill's shown level, labelled by its source, with no score anywhere (S11.1, S11.2, S11.3, S11.7)", async () => {
    const user = userEvent.setup();
    // The person's own Proficient rating meets backend engineer's SQL requirement.
    const { container } = await openGap(user, fullProfile(3), "Backend engineer");

    const claimed = screen.getByRole("region", { name: "Claimed" });
    const sql = within(claimed).getByRole("listitem", { name: /SQL/ });
    within(sql).getByText(/Asks for Proficient 3/);
    within(sql).getByText(/Shows Proficient 3 · Self-reported, your own rating/);
    within(sql).getByText(/Payments API/);
    expect(within(sql).getByRole("link", { name: "SQL" }).getAttribute("href")).toBe("/skills/sql");
    screen.getByRole("region", { name: "Nothing in your profile yet" });
    expect(screen.queryByRole("region", { name: "Supported" })).toBeNull();
    expect(container.textContent).not.toMatch(/verified|score|%|\btotal\b|rank/i);
    await expectNoAxeViolations(container);
  });

  it("stores the gap as a readable file, with the pathway pinned to its version (S11.4)", async () => {
    const user = userEvent.setup();
    const memory = fullProfile(3);
    await openGap(user, memory, "Backend engineer");

    const text = await fileContaining(memory, "schema: gap/1");
    expect(text).toMatch(/pathway: pharoam-core@\d+\.\d+\.\d+:backend-engineer\n/);
    expect(text).toContain("## Your gap to Backend engineer");
    expect(text).toContain(
      "- SQL (core): asks for Proficient (3). Shows Proficient (3), your own rating, citing Payments API.",
    );
    screen.getByText("Updated just now");
  });

  it("regenerates the gap when the person's levels change, and refreshes by hand (S11.5)", async () => {
    const user = userEvent.setup();
    await openGap(user, fullProfile(3), "Backend engineer");
    await user.click(
      within(screen.getByRole("region", { name: "Claimed" })).getByRole("link", { name: "SQL" }),
    );

    await user.click(await screen.findByRole("button", { name: "Correct Proficient, 3 Oct 2026" }));
    await user.click(screen.getByRole("radio", { name: /^Beginner/ }));
    await user.click(screen.getByRole("button", { name: "Save the correction" }));
    await screen.findByText(/Beginner/, { selector: "[data-shown-level]" });
    await user.click(screen.getByRole("link", { name: "Pathways" }));
    await user.click(await screen.findByRole("link", { name: "Backend engineer" }));
    await user.click(await screen.findByRole("link", { name: "See my gap to this pathway" }));

    const below = await screen.findByRole("region", { name: "Below the level asked, for now" });
    within(below).getByRole("listitem", { name: /SQL/ });
    await user.click(screen.getByRole("button", { name: "Bring the gap up to date" }));
    await screen.findByText("Updated just now");
  });

  it("lets the person explore any pathway, however far off (S11.6)", async () => {
    const user = userEvent.setup();
    await openGap(user, emptyProfile(), "Machine-learning engineer");

    const unknown = screen.getByRole("region", { name: "Nothing in your profile yet" });
    expect(within(unknown).getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(screen.queryByRole("region", { name: "Claimed" })).toBeNull();
  });
});
