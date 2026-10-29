import { createMemoryConnector, type MemoryConnector } from "@pharoam/core/testing";
import { screen } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "../testing/axe.ts";
import { renderApp } from "../__fixtures__/render-app.tsx";

const PHAROAM = [
  "---",
  "schema: pharoam/1",
  "id: 0192f3a1-0000-7000-8000-000000000001",
  "created: 2026-10-01T09:00:00Z",
  "updated: 2026-10-01T09:00:00Z",
  "headline: Backend developer",
  "situation:",
  "  stage: working",
  "  field: Fintech",
  "region: GB",
  "focus:",
  "  pathways:",
  "    - backend-engineer",
  "    - data-engineer",
  "  skills:",
  "    - python",
  "mentor: Not a field Pharoam knows",
  "---",
  "",
].join("\n");

const MY_WORDS = "# About me\n\nI like *small* teams.\n";

function folder(body = MY_WORDS): MemoryConnector {
  return createMemoryConnector({ "pharoam.md": PHAROAM + body });
}

async function openAbout(user: UserEvent, memory: MemoryConnector) {
  const rendered = renderApp({ name: "my-profile", memory });
  await user.click(await screen.findByRole("button", { name: "Choose a folder" }));
  await user.click(await screen.findByRole("link", { name: "About you" }));
  await screen.findByRole("heading", { level: 1, name: "About you" });
  return rendered;
}

describe('S3: keep "about me" in my own words', () => {
  it("shows the profile's fields, ready to change", async () => {
    const user = userEvent.setup();
    const { container } = await openAbout(user, folder());

    expect(screen.getByLabelText<HTMLInputElement>("Headline").value).toBe("Backend developer");
    expect(screen.getByLabelText<HTMLSelectElement>("What are you doing now?").value).toBe("working");
    expect(screen.getByLabelText<HTMLInputElement>(/In which field/).value).toBe("Fintech");
    expect(screen.getByLabelText<HTMLSelectElement>(/Country/).value).toBe("GB");
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Backend engineer" }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Frontend engineer" }).checked).toBe(false);
    // Only the page you're on is marked as current in the navigation.
    expect(screen.getByRole("link", { name: "About you" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Profile" }).getAttribute("aria-current")).toBeNull();
    await expectNoAxeViolations(container);
  });

  it("saves changed fields to pharoam.md and marks the time of the change (S3.1)", async () => {
    const user = userEvent.setup();
    const memory = folder();
    await openAbout(user, memory);

    const headline = screen.getByLabelText("Headline");
    await user.clear(headline);
    await user.type(headline, "Backend developer moving into ML");
    await user.selectOptions(screen.getByLabelText("What are you doing now?"), "Changing career");
    await user.click(screen.getByRole("checkbox", { name: "Machine-learning engineer" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByText("Saved to pharoam.md.");
    const text = (await memory.readOutside("pharoam.md")) ?? "";
    expect(text).toContain("headline: Backend developer moving into ML");
    expect(text).toContain("stage: changing-career");
    expect(text).not.toContain("updated: 2026-10-01T09:00:00Z");
    expect(text).toMatch(/pathways:\n\s+- backend-engineer\n\s+- ml-engineer\n\s+- data-engineer/);
  });

  it("keeps what the form doesn't show: focus skills, pathways Pharoam doesn't have, unknown fields and the person's own words", async () => {
    const user = userEvent.setup();
    const memory = folder();
    await openAbout(user, memory);

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByText("Saved to pharoam.md.");
    const text = (await memory.readOutside("pharoam.md")) ?? "";
    expect(text).toMatch(/skills:\n\s+- python/);
    expect(text).toContain("- data-engineer");
    expect(text).toContain("mentor: Not a field Pharoam knows");
    expect(text.endsWith(`---\n${MY_WORDS}`)).toBe(true);
  });

  it("removes a field the person clears", async () => {
    const user = userEvent.setup();
    const memory = folder();
    await openAbout(user, memory);

    await user.clear(screen.getByLabelText("Headline"));
    await user.selectOptions(screen.getByLabelText(/Country/), "Not saying");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByText("Saved to pharoam.md.");
    const text = (await memory.readOutside("pharoam.md")) ?? "";
    expect(text).not.toContain("headline:");
    expect(text).not.toContain("region:");
  });

  it("says nothing was overwritten when pharoam.md changed in the folder since it was read (AD10)", async () => {
    const user = userEvent.setup();
    const memory = folder();
    await openAbout(user, memory);
    await memory.putOutside(
      "pharoam.md",
      PHAROAM.replace("Backend developer", "Edited in Obsidian") + MY_WORDS,
    );

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByText("pharoam.md was changed in your folder since Pharoam read it");
    expect(await memory.readOutside("pharoam.md")).toContain("Edited in Obsidian");
  });

  it("brings the overview up to date between its markers, leaving the person's own words as they are (S3.2, S3.3)", async () => {
    const user = userEvent.setup();
    const memory = folder();
    await openAbout(user, memory);

    await user.click(screen.getByRole("button", { name: "Bring the overview up to date" }));

    await screen.findByText("The overview in pharoam.md is up to date.");
    const text = (await memory.readOutside("pharoam.md")) ?? "";
    expect(text).toContain(MY_WORDS);
    expect(text).toMatch(
      /<!-- pharoam:overview -->\n## Overview[\s\S]*- Nothing recorded yet\n<!-- \/pharoam:overview -->/,
    );
  });

  it("explains broken overview markers, and changes nothing (S3.2)", async () => {
    const user = userEvent.setup();
    const broken = "<!-- pharoam:overview -->\nOne\n<!-- pharoam:overview -->\nTwo\n";
    const memory = folder(broken);
    const { container } = await openAbout(user, memory);
    const before = await memory.readOutside("pharoam.md");

    await user.click(screen.getByRole("button", { name: "Bring the overview up to date" }));

    await screen.findByText("The overview in pharoam.md can't be updated");
    screen.getByText(/one start marker followed by one end marker/);
    expect(await memory.readOutside("pharoam.md")).toBe(before);
    await expectNoAxeViolations(container);
  });
});
