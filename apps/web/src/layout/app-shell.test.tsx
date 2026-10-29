import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderUi } from "../__fixtures__/render-ui.tsx";
import { expectNoAxeViolations } from "../testing/axe.ts";
import { AppShell } from "./app-shell.tsx";

describe("AppShell", () => {
  it("shows the folder and the main areas beside the page", async () => {
    const { container } = renderUi(
      <AppShell folder="my-profile" attention={0} onDisconnect={vi.fn()}>
        <h1>{"Page"}</h1>
      </AppShell>,
    );

    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Profile", "Skills", "Evidence", "Pathways", "About you", "Needs attention"]);
    screen.getByText("my-profile");
    expect(screen.getByRole("main").textContent).toBe("Page");
    await expectNoAxeViolations(container);
  });

  it("counts what needs attention, in words read with the link", async () => {
    renderUi(
      <AppShell folder="my-profile" attention={3} onDisconnect={vi.fn()}>
        {null}
      </AppShell>,
    );

    await screen.findByRole("link", { name: "Needs attention 3" });
  });

  it("disconnects the folder it names", async () => {
    const onDisconnect = vi.fn();
    renderUi(
      <AppShell folder="my-profile" attention={0} onDisconnect={onDisconnect}>
        {null}
      </AppShell>,
    );

    await userEvent.setup().click(await screen.findByRole("button", { name: "Disconnect my-profile" }));
    expect(onDisconnect).toHaveBeenCalledOnce();
  });
});
