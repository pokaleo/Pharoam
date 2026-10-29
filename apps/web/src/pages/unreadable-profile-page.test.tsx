import { createMemoryConnector } from "@pharoam/core/testing";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "../__fixtures__/render-app.tsx";
import { expectNoAxeViolations } from "../testing/axe.ts";

const BROKEN = "---\nschema: pharoam/1\nid: [broken\n---\n";

describe("UnreadableProfilePage", () => {
  it("says pharoam.md can't be read instead of offering to replace it, and writes nothing (hard rule 3)", async () => {
    const user = userEvent.setup();
    const memory = createMemoryConnector({ "pharoam.md": BROKEN });
    const { container } = renderApp({ name: "my-profile", memory });

    await user.click(await screen.findByRole("button", { name: "Choose a folder" }));

    await screen.findByRole("heading", { level: 1, name: "pharoam.md in my-profile can't be read" });
    expect(screen.queryByRole("button", { name: "Create my profile" })).toBeNull();
    expect(memory.writes()).toBe(0);
    expect(await memory.readOutside("pharoam.md")).toBe(BROKEN);
    await expectNoAxeViolations(container);
  });

  it("goes back to choosing a folder", async () => {
    const user = userEvent.setup();
    renderApp({ name: "my-profile", memory: createMemoryConnector({ "pharoam.md": BROKEN }) });
    await user.click(await screen.findByRole("button", { name: "Choose a folder" }));

    await user.click(await screen.findByRole("button", { name: "Choose another folder" }));

    await screen.findByRole("heading", { level: 1, name: "Your skills, in files you own" });
  });
});
