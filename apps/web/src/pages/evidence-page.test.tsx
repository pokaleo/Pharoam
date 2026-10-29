import { screen, within } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { EVIDENCE, EVIDENCE_ID, fullProfile, openProfile, SQL } from "../__fixtures__/profiles.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

async function openPaymentsApi(user: UserEvent, memory = fullProfile()) {
  const rendered = await openProfile(user, memory, "Evidence");
  await user.click(await screen.findByRole("link", { name: "Payments API" }));
  await screen.findByRole("heading", { level: 1, name: "Payments API" });
  return { memory, ...rendered };
}

describe("EvidencePage", () => {
  it("shows links as links, skills by name, and what the person did as safe Markdown (MVP S4.5)", async () => {
    const user = userEvent.setup();
    const { container } = await openPaymentsApi(user);

    expect(screen.getByRole("link", { name: "https://example.com/payments" }).getAttribute("href")).toBe(
      "https://example.com/payments",
    );
    expect(screen.getByText("refunds").tagName).toBe("STRONG");
    screen.getByText("Python");
    screen.getByText(EVIDENCE);
    await expectNoAxeViolations(container);
  });

  it("asks before deleting, naming the levels that cite the evidence, then removes the file (MVP S5.2, S5.3)", async () => {
    const user = userEvent.setup();
    const { memory, container } = await openPaymentsApi(user);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    const confirm = await screen.findByRole("alertdialog", { name: "Delete Payments API?" });
    within(confirm).getByText(/SQL/);
    expect(await memory.readOutside(EVIDENCE)).toBeDefined();
    await expectNoAxeViolations(container);

    await user.click(within(confirm).getByRole("button", { name: "Delete it" }));

    await screen.findByRole("heading", { level: 1, name: "Evidence" });
    screen.getByText("Payments API was deleted from your folder.");
    expect(await memory.readOutside(EVIDENCE)).toBeUndefined();
    // The level that cited it is never changed (hard rule 4).
    expect(await memory.readOutside(SQL)).toContain(`- ${EVIDENCE_ID}`);
  });

  it("keeps the evidence when the person changes their mind", async () => {
    const user = userEvent.setup();
    const { memory } = await openPaymentsApi(user);
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await user.click(screen.getByRole("button", { name: "Keep it" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(await memory.readOutside(EVIDENCE)).toBeDefined();
  });
});
