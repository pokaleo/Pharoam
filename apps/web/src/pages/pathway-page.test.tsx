import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fullProfile, openProfile } from "../__fixtures__/profiles.ts";
import { loadContentPack } from "../content.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

describe("PathwayPage (MVP S10.2, S10.3)", () => {
  it("shows each requirement with its skill, level, importance and source, and who reviewed it", async () => {
    const user = userEvent.setup();
    const pack = await loadContentPack();
    const pathway = pack.pathways.find((p) => p.slug === "backend-engineer");
    const { container } = await openProfile(user, fullProfile(), "Pathways");

    await user.click(await screen.findByRole("link", { name: "Backend engineer" }));

    await screen.findByRole("heading", { level: 1, name: "Backend engineer" });
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(pathway?.requirements.length ?? -1);
    const sql = screen.getByRole("row", { name: /^SQL/ });
    within(sql).getByText("Proficient");
    within(sql).getByText("Core");
    expect(within(sql).getAllByRole("link").length).toBeGreaterThan(0);
    screen.getByText("Reviewed by The Pharoam founder on 28 Oct 2026.");
    screen.getByText(/Drafted with AI \(anthropic\/claude-opus-5-5\), then reviewed by The Pharoam founder/);
    screen.getByRole("link", { name: "See my gap to this pathway" });
    await expectNoAxeViolations(container);
  });
});
