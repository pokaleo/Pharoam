import type { MemoryConnector } from "@pharoam/core/testing";
import { screen } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { EVIDENCE, fullProfile, openProfile } from "../__fixtures__/profiles.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

async function openForm(user: UserEvent, memory: MemoryConnector = fullProfile()) {
  const rendered = await openProfile(user, memory, "Evidence");
  await user.click(await screen.findByRole("link", { name: "Add evidence" }));
  await screen.findByRole("heading", { level: 1, name: "Add evidence" });
  return rendered;
}

async function evidenceFiles(memory: MemoryConnector): Promise<string[]> {
  const listed = await memory.connector.list();
  return listed.ok ? listed.value.map((ref) => ref.location).filter((l) => l.startsWith("evidence")) : [];
}

// The text of the elements that describe a field, where its hint and error are.
function description(field: HTMLElement): string {
  const ids = (field.getAttribute("aria-describedby") ?? "").split(" ").filter((id) => id !== "");
  return ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
}

describe("NewEvidencePage (MVP S4)", () => {
  it("shows the common fields plus the chosen kind's own (S4.1)", async () => {
    const user = userEvent.setup();
    const { container } = await openForm(user);

    await user.click(screen.getByRole("radio", { name: "Course or module" }));
    screen.getByLabelText(/Course code/);
    screen.getByLabelText(/Credits/);
    screen.getByLabelText(/Grade/);
    expect(screen.queryByLabelText(/Issued by/)).toBeNull();

    await user.click(screen.getByRole("radio", { name: "Certificate" }));
    screen.getByLabelText(/Issued by/);
    screen.getByLabelText(/Credential ID/);
    screen.getByLabelText(/Expires/);
    expect(screen.queryByLabelText(/Course code/)).toBeNull();
    screen.getByLabelText("Title");
    screen.getByLabelText(/Organisation/);
    await expectNoAxeViolations(container);
  });

  it("previews the record exactly as it will be stored, writes nothing until confirmed, then writes one file (S4.2, S4.3, S4.6)", async () => {
    const user = userEvent.setup();
    const memory = fullProfile();
    const { container } = await openForm(user, memory);

    await user.click(screen.getByRole("radio", { name: "Job" }));
    await user.type(screen.getByLabelText("Title"), "Backend engineer");
    await user.type(screen.getByLabelText(/Organisation/), "Example Co");
    await user.type(screen.getByLabelText(/Started/), "2023-01");
    await user.type(screen.getByLabelText(/Ended/), "2024-09");
    await user.type(screen.getByLabelText(/Links/), "https://example.com/team");
    await user.type(screen.getByLabelText(/Find a skill/), "SQL");
    await user.click(screen.getByRole("button", { name: "Add skill" }));
    await user.type(screen.getByLabelText(/What you did/), "Ran the <b>billing</b> service.");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const preview = await screen.findByRole("region", { name: "The file as it will be stored" });
    const text = preview.textContent;
    expect(text).toMatch(/^---\nschema: evidence\/1\nid: [0-9a-f-]{36}\n/);
    expect(text).toContain("ai: null");
    expect(text).toContain("kind: job");
    expect(text).toContain("source: manual");
    expect(text).toMatch(/skills:\n\s+- sql/);
    expect(text).toContain("Ran the <b>billing</b> service.");
    expect(memory.writes()).toBe(0);
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole("button", { name: "Save evidence" }));

    await screen.findByRole("heading", { level: 1, name: "Backend engineer" });
    const saved = (await evidenceFiles(memory)).filter((location) => location !== EVIDENCE);
    expect(saved).toHaveLength(1);
    expect(await memory.readOutside(saved[0] ?? "")).toBe(text);
  });

  it("goes back to the form from the preview with every answer kept", async () => {
    const user = userEvent.setup();
    await openForm(user);
    await user.type(screen.getByLabelText("Title"), "Hackathon entry");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.click(await screen.findByRole("button", { name: "Change something" }));

    expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe("Hackathon entry");
  });

  it("explains what to fix next to each field, and writes nothing (S4.4)", async () => {
    const user = userEvent.setup();
    const memory = fullProfile();
    await openForm(user, memory);

    await user.type(screen.getByLabelText(/Started/), "2024-13");
    await user.type(screen.getByLabelText(/Links/), "example.com");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const title = screen.getByLabelText("Title");
    expect(title.getAttribute("aria-invalid")).toBe("true");
    expect(description(title)).toContain("Give it a title, such as the project's name or your job title.");
    expect(description(screen.getByLabelText(/Started/))).toContain(
      "Write a date as a year, a month or a day",
    );
    expect(description(screen.getByLabelText(/Links/))).toContain(
      "Each link must start with http:// or https://",
    );
    expect(screen.queryByRole("region", { name: "The file as it will be stored" })).toBeNull();
    expect(memory.writes()).toBe(0);
  });

  it("explains an end before the start", async () => {
    const user = userEvent.setup();
    await openForm(user);

    await user.type(screen.getByLabelText("Title"), "Course");
    await user.type(screen.getByLabelText(/Started/), "2024-09");
    await user.type(screen.getByLabelText(/Ended/), "2023");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(description(screen.getByLabelText(/Ended/))).toContain("The end is before the start.");
  });
});
