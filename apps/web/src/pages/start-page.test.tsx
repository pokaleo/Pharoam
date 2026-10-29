import { createMemoryConnector } from "@pharoam/core/testing";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fullProfile } from "../__fixtures__/profiles.ts";
import { renderApp } from "../__fixtures__/render-app.tsx";
import { expectNoAxeViolations } from "../testing/axe.ts";

describe("StartPage", () => {
  it("says where the profile lives, and offers to choose a folder", async () => {
    const { container } = renderApp({ name: "my-profile", memory: createMemoryConnector() });

    await screen.findByRole("heading", { level: 1, name: "Your skills, in files you own" });
    screen.getByText(/never on Pharoam's servers/);
    screen.getByRole("button", { name: "Choose a folder" });
    await expectNoAxeViolations(container);
  });

  it("explains why permission is needed when it is denied, and reads and writes nothing (MVP S1.4)", async () => {
    const user = userEvent.setup();
    const memory = createMemoryConnector();
    const { container, lists } = renderApp({ name: "my-profile", memory, answer: { kind: "denied" } });

    await user.click(await screen.findByRole("button", { name: "Choose a folder" }));

    await screen.findByText("Pharoam needs permission to read and write the folder");
    screen.getByText(/Your profile is the files in that folder/);
    expect(memory.writes()).toBe(0);
    expect(lists()).toBe(0);
    await expectNoAxeViolations(container);
  });

  it("does nothing when the person closes the folder picker", async () => {
    const user = userEvent.setup();
    renderApp({ name: "my-profile", memory: createMemoryConnector(), answer: { kind: "cancelled" } });

    await user.click(await screen.findByRole("button", { name: "Choose a folder" }));

    await screen.findByRole("heading", { level: 1, name: "Your skills, in files you own" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers the folder from the last visit, and reads nothing until the person asks (MVP S2.2)", async () => {
    const user = userEvent.setup();
    const { lists } = renderApp({ name: "pharoam-profile", memory: fullProfile(), remembered: true });

    const reopen = await screen.findByRole("button", { name: "Open pharoam-profile again" });
    expect(lists()).toBe(0);

    await user.click(reopen);
    await screen.findByRole("link", { name: "Profile" });
    expect(lists()).toBe(1);
  });

  it("says when the folder can't be read, and offers to choose again", async () => {
    const user = userEvent.setup();
    const memory = fullProfile();
    memory.loseAccess();
    renderApp({ name: "pharoam-profile", memory });

    await user.click(await screen.findByRole("button", { name: "Choose a folder" }));

    await screen.findByText("Pharoam couldn't read pharoam-profile");
    screen.getByRole("button", { name: "Choose a folder" });
  });
});
