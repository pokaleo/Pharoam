import { createMemoryConnector } from "@pharoam/core/testing";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fullProfile } from "../__fixtures__/profiles.ts";
import { renderApp } from "../__fixtures__/render-app.tsx";

describe("HomePage", () => {
  it("shows the start page before a folder is open", async () => {
    renderApp({ name: "my-profile", memory: fullProfile() });

    await screen.findByRole("heading", { level: 1, name: "Your skills, in files you own" });
  });

  it("shows the profile form for a folder without a profile (MVP S2.3)", async () => {
    const user = userEvent.setup();
    renderApp({ name: "my-profile", memory: createMemoryConnector() });

    await user.click(await screen.findByRole("button", { name: "Choose a folder" }));

    await screen.findByRole("heading", { level: 1, name: "Create your profile in my-profile" });
  });

  it("shows the open profile in the app shell, and the start page again after disconnecting (MVP S2.4)", async () => {
    const user = userEvent.setup();
    const rendered = renderApp({ name: "pharoam-profile", memory: fullProfile(), remembered: true });
    await user.click(await screen.findByRole("button", { name: "Open pharoam-profile again" }));
    await screen.findByRole("link", { name: "Profile" });

    await user.click(screen.getByRole("button", { name: "Disconnect pharoam-profile" }));

    await screen.findByRole("heading", { level: 1, name: "Your skills, in files you own" });
    expect(rendered.forgotten()).toBe(true);
    expect(screen.queryByRole("button", { name: /again/ })).toBeNull();
    expect(rendered.container.textContent).not.toMatch(/Payments API|payments-api/);
  });
});
