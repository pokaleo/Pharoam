import type { MemoryConnector } from "@pharoam/core/testing";
import { screen, within } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { packWithBank, packWithBankAt, RIGHT, WRONG } from "../__fixtures__/bank.ts";
import { fileContaining, fullProfile, navLink } from "../__fixtures__/profiles.ts";
import { scanModel, setUpModel } from "../__fixtures__/models.ts";
import { renderApp } from "../__fixtures__/render-app.tsx";
import { expectNoAxeViolations } from "../testing/axe.ts";

// Opens the profile with the test bank in the pack, on a skill's page. fullProfile(2) rates SQL as Working.
async function onSkill(
  user: UserEvent,
  skill = "SQL",
  memory: MemoryConnector = fullProfile(2),
  content = packWithBank,
) {
  const rendered = renderApp({ name: "my-profile", memory, content });
  await user.click(await screen.findByRole("button", { name: "Choose a folder" }));
  await screen.findByRole("link", { name: "Profile" }, { timeout: 5000 });
  await user.click(await navLink("Skills"));
  await user.click(await screen.findByRole("link", { name: skill }));
  await screen.findByRole("heading", { level: 1, name: skill });
  return { memory, ...rendered };
}

// Answers the question on screen, right or wrong.
async function answer(user: UserEvent, right: boolean): Promise<void> {
  await user.click(await screen.findByRole("radio", { name: right ? RIGHT : WRONG }));
  await user.click(screen.getByRole("button", { name: "Answer" }));
}

const assessment = async (memory: MemoryConnector): Promise<string> =>
  fileContaining(memory, "kind: assessment");

describe("taking a question-bank diagnostic (MVP S19, S21.1)", () => {
  it("offers a diagnostic for a skill the bank covers, and not for one it doesn't (S19.1, S21.1)", async () => {
    const user = userEvent.setup();
    await onSkill(user);
    screen.getByRole("link", { name: "Check it with a diagnostic" });

    await user.click(await navLink("Skills"));
    await user.click(await screen.findByRole("link", { name: "Record a level" }));
    await user.type(await screen.findByLabelText("Skill"), "Docker");
    await user.click(screen.getByRole("radio", { name: /^Working/ }));
    await user.click(screen.getByRole("button", { name: "Record my level" }));
    await screen.findByRole("heading", { level: 1, name: "Docker" });
    expect(screen.queryByRole("link", { name: "Check it with a diagnostic" })).toBeNull();
  });

  it("says how it works and where it starts before anything is written (S19.1)", async () => {
    const user = userEvent.setup();
    const { container, memory } = await onSkill(user);
    const writes = memory.writes();

    await user.click(screen.getByRole("link", { name: "Check it with a diagnostic" }));

    await screen.findByRole("heading", { level: 1, name: "SQL diagnostic" });
    screen.getByText(/one question at a time/i);
    screen.getByText(/Your evidence isn't considered/);
    screen.getByText(/It starts at Working/);
    expect(memory.writes()).toBe(writes);
    await expectNoAxeViolations(container);
  });

  it("asks one question at a time without marking it, and gives the level with the path taken (S19.2, S19.4, S19.5)", async () => {
    const user = userEvent.setup();
    const { container, memory } = await onSkill(user);
    await user.click(screen.getByRole("link", { name: "Check it with a diagnostic" }));
    await user.click(await screen.findByRole("button", { name: "Start" }));

    await screen.findByText("Question 1");
    screen.getByRole("group", { name: /SQL question . at level 2\?/ });
    await expectNoAxeViolations(container);
    await answer(user, true);
    await screen.findByText("Question 2");
    expect(screen.queryByText(/right|wrong/i, { selector: "[data-marking]" })).toBeNull();
    await answer(user, false);
    await answer(user, true);
    await answer(user, false);

    await screen.findByRole("heading", { level: 1, name: "Your SQL result" });
    screen.getByText("Based on this session only. Your evidence wasn't considered.");
    within(screen.getByRole("region", { name: "The result" })).getByText("Working");
    const path = screen.getByRole("list", { name: "The questions, in the order asked" });
    expect(within(path).getAllByRole("listitem")).toHaveLength(4);
    expect(within(path).getAllByText("Right")).toHaveLength(2);
    expect(within(path).getAllByText("Not right")).toHaveLength(2);
    await expectNoAxeViolations(container);

    const record = await assessment(memory);
    expect(record).toContain("title: SQL diagnostic");
    expect(record).toContain("result: 2");
    expect(record).toMatch(/integrity: sha256-c1:[0-9a-f]{64}/);
  });

  it("shows the result as the skill's level, from a diagnostic, linking to its record (S19.5)", async () => {
    const user = userEvent.setup();
    await onSkill(user);
    await user.click(screen.getByRole("link", { name: "Check it with a diagnostic" }));
    await user.click(await screen.findByRole("button", { name: "Start" }));
    for (const right of [true, false, true, false]) await answer(user, right);
    await screen.findByRole("heading", { level: 1, name: "Your SQL result" });

    await user.click(screen.getByRole("link", { name: "Back to SQL" }));

    const history = await screen.findByRole("region", { name: "Skill history" });
    within(history).getByText("Demonstrated");
    within(history).getByRole("link", { name: "See the diagnostic" });
  });

  it("resumes at the same question after leaving, and abandons without a result (S19.6)", async () => {
    const user = userEvent.setup();
    const { memory } = await onSkill(user);
    await user.click(screen.getByRole("link", { name: "Check it with a diagnostic" }));
    await user.click(await screen.findByRole("button", { name: "Start" }));
    await answer(user, true);
    const second = (await screen.findByRole("group")).querySelector("legend")?.textContent ?? "";
    await user.click(screen.getByRole("link", { name: "Leave for now" }));

    await screen.findByRole("heading", { level: 1, name: "SQL" });
    await user.click(screen.getByRole("link", { name: "Continue the diagnostic" }));
    await screen.findByText("Question 2");
    expect(screen.getByRole("group").querySelector("legend")?.textContent).toBe(second);

    await user.click(screen.getByRole("button", { name: "Abandon it" }));
    await user.click(await screen.findByRole("button", { name: "Abandon the diagnostic" }));

    await screen.findByRole("heading", { level: 1, name: "SQL" });
    screen.getByRole("link", { name: "Check it with a diagnostic" });
    expect(await assessment(memory)).toBe("");
  });

  it("lists the diagnostic's record among the evidence as a diagnostic, never to be edited (S19.5)", async () => {
    const user = userEvent.setup();
    await onSkill(user);
    await user.click(screen.getByRole("link", { name: "Check it with a diagnostic" }));
    await user.click(await screen.findByRole("button", { name: "Start" }));
    for (const right of [true, false, true, false]) await answer(user, right);
    await screen.findByRole("heading", { level: 1, name: "Your SQL result" });

    await user.click(await navLink("Evidence"));

    const row = (await screen.findByRole("link", { name: "SQL diagnostic" })).closest("li");
    expect(row?.textContent).toContain("Diagnostic");
    expect(row?.textContent).not.toContain("assessment");
  });

  it("names the level it will really start at, the nearest the bank covers (S19.1)", async () => {
    const user = userEvent.setup();
    // The person's own SQL is Expert (4), and the bank has items up to Proficient (3) only.
    await onSkill(user, "SQL", fullProfile(4), packWithBankAt([0, 1, 2, 3]));
    await user.click(screen.getByRole("link", { name: "Check it with a diagnostic" }));

    await screen.findByText(/It starts at Proficient \(3\)/);
  });

  it("goes to writing the result, saying why, when the last answer is in but the result couldn't be written", async () => {
    const user = userEvent.setup();
    const { memory } = await onSkill(user);
    await user.click(screen.getByRole("link", { name: "Check it with a diagnostic" }));
    await user.click(await screen.findByRole("button", { name: "Start" }));
    for (const right of [true, false, true]) await answer(user, right);
    // SQL's skill record changes in another app, so the result's level can't be added to it.
    await memory.putOutside("skills/sql.md", `${memory.text("skills/sql.md") ?? ""}\n`);
    await answer(user, false);

    await screen.findByRole("heading", { level: 1, name: "Your answers are in" });
    screen.getByRole("alert");
    screen.getByRole("button", { name: "Write the result" });
  });

  it("moves focus into the confirmation to abandon, and back when the person keeps going", async () => {
    const user = userEvent.setup();
    await onSkill(user);
    await user.click(screen.getByRole("link", { name: "Check it with a diagnostic" }));
    await user.click(await screen.findByRole("button", { name: "Start" }));
    await screen.findByText("Question 1");

    await user.click(screen.getByRole("button", { name: "Abandon it" }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Abandon this diagnostic?" }));
    await user.click(screen.getByRole("button", { name: "Keep going" }));

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Abandon it" }));
  });

  it("keeps the line breaks and indentation of a question's code, while asking and in the path (S19.2, S19.4)", async () => {
    const user = userEvent.setup();
    await onSkill(user);
    await user.click(screen.getByRole("link", { name: "Check it with a diagnostic" }));
    await user.click(await screen.findByRole("button", { name: "Start" }));
    await screen.findByText("Question 1");

    // The browser collapses line breaks and runs of spaces unless told to keep them; the test DOM applies no CSS.
    const kept = (element: Element | null | undefined): boolean =>
      element?.classList.contains("whitespace-pre-wrap") ?? false;
    const question = screen.getByRole("group", { name: /SQL question . at level 2\?/ });
    expect(kept(question.querySelector("legend"))).toBe(true);
    expect(kept(screen.getByText(RIGHT))).toBe(true);
    for (const right of [true, false, true, false]) await answer(user, right);

    const path = await screen.findByRole("list", { name: "The questions, in the order asked" });
    const first = within(path).getAllByRole("listitem")[0];
    expect(kept(within(first ?? path).getByText(/SQL question . at level 2\?/))).toBe(true);
    expect(kept(within(first ?? path).getByText(new RegExp(`^Your answer: ${RIGHT}`)))).toBe(true);
  });
});

describe("after a question-bank result (MVP S21.2)", () => {
  async function toResult(user: UserEvent, withModel: boolean) {
    const test = scanModel();
    renderApp({ name: "my-profile", memory: fullProfile(4), content: packWithBank, providers: test.load });
    await user.click(await screen.findByRole("button", { name: "Choose a folder" }));
    await screen.findByRole("link", { name: "Profile" }, { timeout: 5000 });
    if (withModel) await setUpModel(user);
    await user.click(await navLink("Skills"));
    await user.click(await screen.findByRole("link", { name: "SQL" }));
    await user.click(await screen.findByRole("link", { name: "Check it with a diagnostic" }));
    await user.click(await screen.findByRole("button", { name: "Start" }));
    await answer(user, true);
    await answer(user, true);
    await screen.findByRole("heading", { level: 1, name: "Your SQL result" });
  }

  it("offers a more accurate result with AI, saying why, once a model is set up", async () => {
    const user = userEvent.setup();
    await toResult(user, true);

    const offer = screen.getByRole("link", { name: "Get a more accurate result with AI" });
    expect(offer.getAttribute("href")).toBe("/skills/sql/ai-diagnostic");
    screen.getByText(/questions about your own evidence/i);
  });

  it("says a model is needed for it when none is set up", async () => {
    const user = userEvent.setup();
    await toResult(user, false);

    expect(screen.queryByRole("link", { name: "Get a more accurate result with AI" })).toBeNull();
    screen.getByText(/needs a model/i);
  });
});
