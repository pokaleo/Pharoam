import { createMemoryConnector, type MemoryConnector } from "@pharoam/core/testing";
import { screen, within } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "../testing/axe.ts";
import { renderApp } from "../__fixtures__/render-app.tsx";

const lines = (...text: string[]): string => `${text.join("\n")}\n`;
const PHAROAM = lines(
  "---",
  "schema: pharoam/1",
  "id: 0192f3a1-0000-7000-8000-000000000001",
  "created: 2026-10-01T09:00:00Z",
  "headline: Backend developer",
  "---",
);
const BROKEN_YAML = lines("---", "schema: evidence/1", "title: [unclosed", "---");
const MISSING_TITLE = lines(
  "---",
  "schema: evidence/1",
  "id: 0192f3a1-0000-7000-8000-000000000009",
  "created: 2026-10-02T09:00:00Z",
  "kind: project",
  "---",
);

async function open(user: UserEvent, memory: MemoryConnector) {
  const rendered = renderApp({ name: "my-profile", memory });
  await user.click(await screen.findByRole("button", { name: "Choose a folder" }));
  await screen.findByRole("link", { name: "Profile" });
  return rendered;
}

describe("S12: never lose an edit made outside Pharoam", () => {
  it("lists broken files under Needs attention with a plain explanation, leaving them out and unchanged (S12.2)", async () => {
    const user = userEvent.setup();
    const memory = createMemoryConnector({
      "pharoam.md": PHAROAM,
      "evidence/broken.md": BROKEN_YAML,
      "evidence/untitled.md": MISSING_TITLE,
    });
    const { container } = await open(user, memory);

    await user.click(screen.getByRole("link", { name: "Needs attention 2" }));

    await screen.findByRole("heading", { level: 1, name: "Needs attention" });
    const broken = screen.getByRole("listitem", { name: "evidence/broken.md" });
    within(broken).getByText(/top block isn't valid YAML: .+ \(line \d+\)/);
    const untitled = screen.getByRole("listitem", { name: "evidence/untitled.md" });
    within(untitled).getByText("These fields need fixing: title.");
    screen.getByText(/left out until it's fixed, and Pharoam never changes or deletes it/i);
    expect(await memory.readOutside("evidence/broken.md")).toBe(BROKEN_YAML);
    expect(await memory.readOutside("evidence/untitled.md")).toBe(MISSING_TITLE);
    expect(memory.writes()).toBe(0);
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole("link", { name: "Evidence" }));
    screen.getByText(/No evidence yet/);
  });

  it("shows both versions of a file changed in the folder, and keeps the one the person chooses (S12.1)", async () => {
    const user = userEvent.setup();
    const memory = createMemoryConnector({ "pharoam.md": PHAROAM });
    const { container } = await open(user, memory);
    await user.click(screen.getByRole("link", { name: "About you" }));
    const headline = await screen.findByLabelText("Headline");
    await user.clear(headline);
    await user.type(headline, "Written in Pharoam");
    const edited = PHAROAM.replace("Backend developer", "Written in Obsidian");
    await memory.putOutside("pharoam.md", edited);

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await user.click(await screen.findByRole("link", { name: "Compare the two versions" }));

    await screen.findByRole("heading", { level: 1, name: "Needs attention" });
    const conflict = screen.getByRole("region", { name: "Two versions of pharoam.md" });
    within(within(conflict).getByRole("region", { name: "In your folder" })).getByText(/Written in Obsidian/);
    within(within(conflict).getByRole("region", { name: "From Pharoam" })).getByText(/Written in Pharoam/);
    expect(await memory.readOutside("pharoam.md")).toBe(edited);
    await expectNoAxeViolations(container);

    await user.click(within(conflict).getByRole("button", { name: "Keep the version in your folder" }));

    await screen.findByText("Nothing needs your attention.");
    expect(await memory.readOutside("pharoam.md")).toBe(edited);
  });

  it("writes Pharoam's version when the person keeps it", async () => {
    const user = userEvent.setup();
    const memory = createMemoryConnector({ "pharoam.md": PHAROAM });
    await open(user, memory);
    await user.click(screen.getByRole("link", { name: "About you" }));
    const headline = await screen.findByLabelText("Headline");
    await user.clear(headline);
    await user.type(headline, "Written in Pharoam");
    await memory.putOutside("pharoam.md", PHAROAM.replace("Backend developer", "Written in Obsidian"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await user.click(await screen.findByRole("link", { name: "Compare the two versions" }));

    await user.click(await screen.findByRole("button", { name: "Keep Pharoam's version" }));

    await screen.findByText("Nothing needs your attention.");
    expect(await memory.readOutside("pharoam.md")).toContain("headline: Written in Pharoam");
  });
});
