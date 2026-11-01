import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderUi } from "../__fixtures__/render-ui.tsx";
import { expectNoAxeViolations } from "../testing/axe.ts";
import { AppShell } from "./app-shell.tsx";

describe("AppShell", () => {
  it("shows the folder and the main areas beside the page", async () => {
    const { container } = renderUi(
      <AppShell kind="folder" folder="my-profile" attention={0} onDisconnect={vi.fn()}>
        <h1>{"Page"}</h1>
      </AppShell>,
    );

    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Profile", "Skills", "Evidence", "Pathways", "Needs attention", "About you"]);
    screen.getByText("my-profile");
    expect(screen.getByRole("main").textContent).toBe("Page");
    await expectNoAxeViolations(container);
  });

  it("shows the areas still to come in their places, as not available yet rather than as links", async () => {
    renderUi(
      <AppShell kind="folder" folder="my-profile" attention={0} onDisconnect={vi.fn()}>
        {null}
      </AppShell>,
    );

    const nav = await screen.findByRole("navigation", { name: "Main" });
    for (const name of ["Review", "Assess", "Learning plan", "Prepare", "Activity log", "Settings", "Help"]) {
      const slot = within(nav).getByText(name).closest("[aria-disabled]");
      expect(slot?.getAttribute("aria-disabled"), name).toBe("true");
      expect(slot?.textContent, name).toContain("Later");
    }
    within(nav).getByText("Where next");
  });

  it("folds the sidebar behind a menu button, which says whether it is open", async () => {
    renderUi(
      <AppShell kind="folder" folder="my-profile" attention={0} onDisconnect={vi.fn()}>
        {null}
      </AppShell>,
    );

    const menu = await screen.findByRole("button", { name: "Menu" });
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    await userEvent.setup().click(menu);
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    const sidebar = document.getElementById(menu.getAttribute("aria-controls") ?? "");
    expect(sidebar?.getAttribute("data-open")).toBe("true");
  });

  it("draws the seal for the system's theme, reversed on a dark ground", async () => {
    const { container } = renderUi(
      <AppShell kind="folder" folder="my-profile" attention={0} onDisconnect={vi.fn()}>
        {null}
      </AppShell>,
    );

    await screen.findByRole("button", { name: "Menu" });
    const seals = [...container.querySelectorAll("picture")].filter((picture) =>
      picture.querySelector("img")?.getAttribute("src")?.includes("seal"),
    );
    // The top bar's and the footer's.
    expect(seals).toHaveLength(2);
    for (const seal of seals) {
      const dark = seal.querySelector("source[media='(prefers-color-scheme: dark)']");
      expect(dark?.getAttribute("srcset")).toContain("seal-reversed");
      expect(seal.querySelector("img")?.getAttribute("alt")).toBe("");
    }
  });

  it("says where the profile is kept, in the browser's own storage or a folder", async () => {
    renderUi(
      <AppShell kind="browser" folder="This browser" attention={0} onDisconnect={vi.fn()}>
        {null}
      </AppShell>,
    );

    await screen.findByText("Kept in this browser");
    screen.getByRole("button", { name: "Close the profile in this browser" });
  });

  it("counts what needs attention, in words read with the link", async () => {
    renderUi(
      <AppShell kind="folder" folder="my-profile" attention={3} onDisconnect={vi.fn()}>
        {null}
      </AppShell>,
    );

    await screen.findByRole("link", { name: "Needs attention 3" });
  });

  it("disconnects the folder it names", async () => {
    const onDisconnect = vi.fn();
    renderUi(
      <AppShell kind="folder" folder="my-profile" attention={0} onDisconnect={onDisconnect}>
        {null}
      </AppShell>,
    );

    await userEvent.setup().click(await screen.findByRole("button", { name: "Disconnect my-profile" }));
    expect(onDisconnect).toHaveBeenCalledOnce();
  });
});
