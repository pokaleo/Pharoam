// The screens where a profile kept in the browser's own storage differs from one in a folder (ADR-0020). Each
// screen's own tests cover the rest; these run the whole app with browser storage, as Safari and Firefox do.
import { createMemoryConnector } from "@pharoam/core/testing";
import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PHAROAM } from "../__fixtures__/profiles.ts";
import { renderApp } from "../__fixtures__/render-app.tsx";
import { expectNoAxeViolations } from "../testing/axe.ts";

const inBrowser = (memory = createMemoryConnector(), extra: { persisted?: boolean } = {}) =>
  renderApp({ name: "pharoam-profile", memory, kind: "browser", ...extra });

// A file the person picked with its folder, as the browser gives it: with its path from the folder they chose.
function picked(path: string, text: string): File {
  const file = new File([text], path.split("/").at(-1) ?? path);
  Object.defineProperty(file, "webkitRelativePath", { value: path });
  return file;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the start page, with browser storage", () => {
  it("says the profile stays in this browser on this device, and offers to keep it there", async () => {
    const { container } = inBrowser();

    await screen.findByRole("button", { name: "Keep my profile in this browser" });
    screen.getByText(/keeps your profile in the browser's own storage on this device/);
    expect(screen.queryByRole("button", { name: "Choose a folder" })).toBeNull();
    await expectNoAxeViolations(container);
  });

  it("creates the profile in this browser", async () => {
    const user = userEvent.setup();
    const memory = createMemoryConnector();
    inBrowser(memory);

    await user.click(await screen.findByRole("button", { name: "Keep my profile in this browser" }));
    await screen.findByRole("heading", { level: 1, name: "Create your profile in this browser" });
    screen.getByText(/in its storage on this device/);
    await user.click(screen.getByRole("button", { name: "Create my profile" }));

    await screen.findByRole("heading", { level: 1, name: "Your profile" });
    expect(memory.writes()).toBe(1);
  });

  it("offers the profile already in this browser again (MVP S2.2)", async () => {
    const user = userEvent.setup();
    inBrowser(createMemoryConnector({ "pharoam.md": PHAROAM }));

    await user.click(await screen.findByRole("button", { name: "Open my profile again" }));

    await screen.findByRole("link", { name: "Profile" });
  });

  it("starts from a folder the person picks, copying its files in, leaving hidden folders out", async () => {
    const user = userEvent.setup();
    const memory = createMemoryConnector();
    inBrowser(memory);

    await user.upload(await screen.findByLabelText("Start from a folder"), [
      picked("my-copy/pharoam.md", PHAROAM),
      picked("my-copy/.obsidian/app.json", "{}"),
    ]);

    await screen.findByRole("link", { name: "Profile" });
    expect(await memory.readOutside("pharoam.md")).toBe(PHAROAM);
    expect(await memory.readOutside(".obsidian/app.json")).toBeUndefined();
  });

  it("explains private windows, where the browser won't keep files", async () => {
    const user = userEvent.setup();
    renderApp({
      name: "pharoam-profile",
      memory: createMemoryConnector(),
      kind: "browser",
      answer: { kind: "unavailable", reason: "UnknownError" },
    });

    await user.click(await screen.findByRole("button", { name: "Keep my profile in this browser" }));

    await screen.findByText("This browser won't keep files for Pharoam");
    screen.getByText(/Private windows don't keep a website's files/);
  });
});

describe("an open profile in browser storage", () => {
  it("names this browser as where it's stored, and closes rather than disconnects", async () => {
    const user = userEvent.setup();
    const { container } = inBrowser(createMemoryConnector({ "pharoam.md": PHAROAM }));
    await user.click(await screen.findByRole("button", { name: "Open my profile again" }));

    const sidebar = await screen.findByRole("complementary", { name: "Pharoam" });
    within(sidebar).getByText("Stored in");
    within(sidebar).getByText("This browser");
    await user.click(within(sidebar).getByRole("button", { name: "Close the profile in this browser" }));

    await screen.findByRole("button", { name: "Open my profile again" });
    await expectNoAxeViolations(container);
  });

  it("asks the person to keep a copy, and downloads every file as a .zip", async () => {
    const user = userEvent.setup();
    const created = vi.fn<(blob: Blob) => string>(() => "blob:copy");
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const { container } = inBrowser(createMemoryConnector({ "pharoam.md": PHAROAM }));
    await user.click(await screen.findByRole("button", { name: "Open my profile again" }));

    const copy = await screen.findByRole("region", { name: "Keep a copy somewhere safe" });
    within(copy).getByText(/delete a website's files after 7 days without a visit/);
    await expectNoAxeViolations(container);
    await user.click(within(copy).getByRole("button", { name: "Download a copy (.zip)" }));

    await within(copy).findByText("Copy downloaded.");
    expect(click).toHaveBeenCalledOnce();
    const zip = new Uint8Array(await (created.mock.calls[0]?.[0] ?? new Blob()).arrayBuffer());
    expect(new TextDecoder().decode(zip)).toContain("pharoam.md");
    expect((click.mock.contexts[0] as HTMLAnchorElement | undefined)?.download).toMatch(
      /^pharoam-\d{4}-\d{2}-\d{2}\.zip$/,
    );
  });

  it("is calmer when the browser has agreed to keep the files", async () => {
    const user = userEvent.setup();
    inBrowser(createMemoryConnector({ "pharoam.md": PHAROAM }), { persisted: true });
    await user.click(await screen.findByRole("button", { name: "Open my profile again" }));

    const copy = await screen.findByRole("region", { name: "Keep a copy somewhere safe" });
    await within(copy).findByText(/has agreed to keep your profile/);
  });
});

describe("an open profile in a folder", () => {
  it("has no copy to download: the folder is already the person's own", async () => {
    const user = userEvent.setup();
    renderApp({ name: "my-profile", memory: createMemoryConnector({ "pharoam.md": PHAROAM }) });
    await user.click(await screen.findByRole("button", { name: "Choose a folder" }));

    await screen.findByRole("link", { name: "Profile" });
    expect(screen.queryByRole("region", { name: "Keep a copy somewhere safe" })).toBeNull();
  });
});
