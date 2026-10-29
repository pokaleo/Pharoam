import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { EVIDENCE, EVIDENCE_ID, fullProfile, openProfile, PAYMENTS_API } from "../__fixtures__/profiles.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

describe("EditEvidencePage (MVP S5.1)", () => {
  it("rewrites the file with the same ID, a new updated time and unknown fields kept", async () => {
    const user = userEvent.setup();
    const memory = fullProfile();
    const { container } = await openProfile(user, memory, "Evidence");
    await user.click(await screen.findByRole("link", { name: "Payments API" }));
    await user.click(await screen.findByRole("link", { name: "Edit" }));

    const title = await screen.findByLabelText<HTMLInputElement>("Title");
    expect(title.value).toBe("Payments API");
    await expectNoAxeViolations(container);
    await user.clear(title);
    await user.type(title, "Payments platform");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByRole("heading", { level: 1, name: "Payments platform" });
    const text = (await memory.readOutside(EVIDENCE)) ?? "";
    expect(text).toContain(`id: ${EVIDENCE_ID}`);
    expect(text).toContain("title: Payments platform");
    expect(text).not.toContain("updated: 2026-10-02T09:00:00Z");
    expect(text).toContain("client: A field Pharoam doesn't know");
    expect(text).toContain("I built the **refunds** flow.");
  });

  it("writes nothing over a file changed in the folder since it was read, and links to both versions (AD10)", async () => {
    const user = userEvent.setup();
    const memory = fullProfile();
    await openProfile(user, memory, "Evidence");
    await user.click(await screen.findByRole("link", { name: "Payments API" }));
    await user.click(await screen.findByRole("link", { name: "Edit" }));
    const edited = PAYMENTS_API.replace("title: Payments API", "title: Edited in Obsidian");
    await memory.putOutside(EVIDENCE, edited);

    await user.click(await screen.findByRole("button", { name: "Save changes" }));

    await screen.findByText("This file was changed in your folder since Pharoam read it");
    screen.getByRole("link", { name: "Compare the two versions" });
    expect(await memory.readOutside(EVIDENCE)).toBe(edited);
  });
});
