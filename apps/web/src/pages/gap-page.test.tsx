import type { MemoryConnector } from "@pharoam/core/testing";
import { screen, within } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { emptyProfile, fileContaining, fullProfile, openProfile, navLink } from "../__fixtures__/profiles.ts";
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

    const claimed = screen.getByRole("region", { name: /^Claimed\b/ });
    const sql = within(claimed).getByRole("row", { name: /SQL/ });
    // Asked for, and shown: the same level, each by name.
    expect(within(sql).getAllByText("Proficient")).toHaveLength(2);
    within(sql).getByText("Self-reported");
    within(sql).getByText(/your own rating/);
    within(sql).getByText(/Payments API/);
    within(sql).getByText(/Core/);
    expect(within(sql).getByRole("link", { name: "SQL" }).getAttribute("href")).toBe("/skills/sql");
    screen.getByRole("region", { name: /^Unknown Nothing in your profile yet/ });
    expect(screen.queryByRole("region", { name: /^Supported\b/ })).toBeNull();
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
      within(screen.getByRole("region", { name: /^Claimed\b/ })).getByRole("link", { name: "SQL" }),
    );

    await user.click(await screen.findByRole("button", { name: "Correct Proficient, 3 Oct 2026" }));
    await user.click(screen.getByRole("radio", { name: /^Beginner/ }));
    await user.click(screen.getByRole("button", { name: "Save the correction" }));
    await screen.findByText(/Beginner/, { selector: "[data-shown-level]" });
    await user.click(await navLink("Pathways"));
    await user.click(await screen.findByRole("link", { name: "Backend engineer" }));
    await user.click(await screen.findByRole("link", { name: "See my gap to this pathway" }));

    const below = await screen.findByRole("region", { name: /^Below Under the level asked, for now/ });
    within(below).getByRole("row", { name: /SQL/ });
    await user.click(screen.getByRole("button", { name: "Bring the gap up to date" }));
    await screen.findByText("Updated just now");
  });

  it("lets the person explore any pathway, however far off (S11.6)", async () => {
    const user = userEvent.setup();
    await openGap(user, emptyProfile(), "Machine-learning engineer");

    const unknown = screen.getByRole("region", { name: /Nothing in your profile yet/ });
    expect(within(unknown).getAllByRole("row", { name: /\S/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("region", { name: /^Claimed\b/ })).toBeNull();
  });

  it("puts what the gap might mean beside what the pathway is, above the groups, with where the pathway came from", async () => {
    const user = userEvent.setup();
    const { container } = await openGap(user, fullProfile(3), "Backend engineer");

    screen.getByText(/Drafted with AI \(anthropic\/claude-opus-5-5\), then reviewed by The Pharoam founder/);
    const about = screen.getByRole("region", { name: "About this pathway" });
    within(about).getByText(/Builds and runs the services behind apps/);
    // The file's own title heading isn't repeated under the card's heading.
    expect(within(about).queryByRole("heading", { name: "Backend engineer" })).toBeNull();
    // Without a model the card says what AI could do, and offers to set one up (MVP S18).
    const meaning = screen.getByRole("region", { name: "What this gap might mean" });
    within(meaning).getByRole("link", { name: "Set up a model" });
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings.slice(0, 2)).toEqual(["What this gap might mean", "About this pathway"]);
    await expectNoAxeViolations(container);
  });

  it("puts the groups to act on first: below, then unknown, then claimed, then supported", async () => {
    const user = userEvent.setup();
    // The person's own Proficient SQL is claimed; the rest of the pathway is unknown.
    await openGap(user, fullProfile(3), "Backend engineer");

    const names = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    const unknown = names.indexOf("Nothing in your profile yet");
    expect(unknown).toBeGreaterThanOrEqual(0);
    expect(unknown).toBeLessThan(names.indexOf("Your word, or an AI judgement you accepted"));
  });
});
