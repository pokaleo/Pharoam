import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { emptyProfile, fullProfile, openProfile } from "../__fixtures__/profiles.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

describe("EvidenceListPage", () => {
  it("lists every piece of evidence, each opening its page", async () => {
    const user = userEvent.setup();
    const { container } = await openProfile(user, fullProfile(), "Evidence");

    await screen.findByRole("heading", { level: 1, name: "Evidence" });
    const list = screen.getByRole("list", { name: "Your evidence" });
    within(list).getByRole("link", { name: "Payments API" });
    within(list).getByText("Project · Example Co");
    screen.getByRole("link", { name: "Add evidence" });
    await expectNoAxeViolations(container);
  });

  it("says what to start with when there's no evidence yet, without a count of nothing", async () => {
    const user = userEvent.setup();
    await openProfile(user, emptyProfile(), "Evidence");

    await screen.findByText(/No evidence yet/);
    expect(screen.queryByText(/^0 /)).toBeNull();
  });
});
