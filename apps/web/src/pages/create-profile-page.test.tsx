import { createMemoryConnector, type MemoryConnector } from "@pharoam/core/testing";
import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fileContaining } from "../__fixtures__/profiles.ts";
import { renderApp } from "../__fixtures__/render-app.tsx";
import { expectNoAxeViolations } from "../testing/axe.ts";

async function chooseEmptyFolder(memory: MemoryConnector = createMemoryConnector()) {
  const user = userEvent.setup();
  const rendered = renderApp({ name: "my-profile", memory });
  await user.click(await screen.findByRole("button", { name: "Choose a folder" }));
  await screen.findByRole("heading", { level: 1, name: "Create your profile in my-profile" });
  return { user, memory, ...rendered };
}

describe("CreateProfilePage (MVP S1)", () => {
  it("offers to create a profile in a folder without one, then writes pharoam.md with the form's fields (S1.1, S1.2, S2.3)", async () => {
    const { user, memory, container } = await chooseEmptyFolder();
    await expectNoAxeViolations(container);

    await user.type(screen.getByLabelText("Headline"), "Backend developer moving into ML");
    await user.selectOptions(screen.getByLabelText("What are you doing now?"), "Working");
    await user.type(screen.getByLabelText(/In which field/), "Fintech");
    await user.selectOptions(screen.getByLabelText(/Country/), "United Kingdom");
    await user.click(screen.getByRole("checkbox", { name: "Machine-learning engineer" }));
    await user.click(screen.getByRole("button", { name: "Create my profile" }));

    await screen.findByRole("heading", { level: 1, name: "Backend developer moving into ML" });
    const text = await fileContaining(memory, "schema: pharoam/1");
    expect(text).toContain("headline: Backend developer moving into ML");
    expect(text).toMatch(/situation:\n\s+stage: working\n\s+field: Fintech/);
    expect(text).toContain("region: GB");
    expect(text).toMatch(/pathways:\n\s+- ml-engineer/);
    expect(memory.initialisations()).toBe(1);
  });

  it("offers no field for a name, photo, contact details or exact location (S1.2, hard rule 8)", async () => {
    await chooseEmptyFolder();

    const form = screen.getByRole("form", { name: "Create your profile in my-profile" });
    // Every field the person can fill in, in the form's order; the pathways are checkboxes of slugs.
    const fields = [...form.querySelectorAll("input:not([type=checkbox]), select, textarea")].map((field) =>
      field.getAttribute("name"),
    );
    expect(fields).toEqual(["headline", "stage", "field", "region"]);
    expect(within(form).queryByLabelText(/name|photo|email|phone|address|city/i)).toBeNull();
    expect(form.querySelector('input[type="file"]')).toBeNull();
  });

  it("creates a profile with every field left empty, since all of them are optional", async () => {
    const { user, memory } = await chooseEmptyFolder();

    await user.click(screen.getByRole("button", { name: "Create my profile" }));

    await screen.findByRole("heading", { level: 1, name: "Your profile" });
    expect(await fileContaining(memory, "schema: pharoam/1")).not.toBe("");
  });

  it("goes back to the start page to choose another folder, writing nothing", async () => {
    const { user, memory } = await chooseEmptyFolder();

    await user.click(screen.getByRole("button", { name: "Choose another folder" }));

    await screen.findByRole("heading", { level: 1, name: "Your skills, in files you own" });
    expect(memory.writes()).toBe(0);
  });
});
