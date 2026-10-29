import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { EVIDENCE, fullProfile, openProfile, SQL } from "../__fixtures__/profiles.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

describe("ProfileHomePage (MVP S2.1)", () => {
  it("lists every file read from the folder, and writes nothing", async () => {
    const user = userEvent.setup();
    const memory = fullProfile();
    const { container } = await openProfile(user, memory);

    await screen.findByRole("heading", { level: 1, name: "Your profile" });
    const files = screen.getByRole("list", { name: "Files in my-profile" });
    expect(
      within(files)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["pharoam.md", EVIDENCE, SQL]);
    expect(memory.writes()).toBe(0);
    await expectNoAxeViolations(container);
  });
});
