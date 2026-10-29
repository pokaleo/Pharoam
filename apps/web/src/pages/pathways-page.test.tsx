import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fullProfile, openProfile } from "../__fixtures__/profiles.ts";
import { loadContentPack } from "../content.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

describe("PathwaysPage (MVP S10.1)", () => {
  it("lists the four pathways with their summaries, in the pack's order, marking those drafted with AI", async () => {
    const user = userEvent.setup();
    const pack = await loadContentPack();
    const { container } = await openProfile(user, fullProfile(), "Pathways");

    const list = await screen.findByRole("list", { name: "Pathways" });
    expect(
      within(list)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(pack.pathways.map((pathway) => pathway.title));
    for (const pathway of pack.pathways) within(list).getByText(pathway.summary);
    expect(within(list).getAllByText("Drafted with AI")).toHaveLength(
      pack.pathways.filter((p) => p.ai !== null).length,
    );
    await expectNoAxeViolations(container);
  });
});
