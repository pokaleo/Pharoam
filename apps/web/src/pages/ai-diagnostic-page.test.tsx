import type { ContentPack, ProviderError } from "@pharoam/core";
import type { MemoryConnector } from "@pharoam/core/testing";
import { screen, within } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { packWithBank, RIGHT } from "../__fixtures__/bank.ts";
import {
  DIAGNOSTIC_EXPLANATION,
  scanModel,
  setUpModel,
  WRITTEN,
  type ScanAnswers,
} from "../__fixtures__/models.ts";
import { fileContaining, fullProfile, navLink } from "../__fixtures__/profiles.ts";
import { renderApp } from "../__fixtures__/render-app.tsx";
import { expectNoAxeViolations } from "../testing/axe.ts";

const AI_LED = "Take an AI-led diagnostic";

// Opens the profile with the test model and bank, sets the model up unless told not to, and goes to SQL's page.
async function onSkill(
  user: UserEvent,
  {
    answers = {},
    memory = fullProfile(2),
    content = packWithBank,
    model = true,
  }: {
    readonly answers?: ScanAnswers;
    readonly memory?: MemoryConnector;
    readonly content?: () => Promise<ContentPack>;
    readonly model?: boolean;
  } = {},
) {
  const test = scanModel(answers);
  const rendered = renderApp({ name: "my-profile", memory, content, providers: test.load });
  await user.click(await screen.findByRole("button", { name: "Choose a folder" }));
  await screen.findByRole("link", { name: "Profile" }, { timeout: 5000 });
  if (model) await setUpModel(user);
  await user.click(await navLink("Skills"));
  await user.click(await screen.findByRole("link", { name: "SQL" }));
  await screen.findByRole("heading", { level: 1, name: "SQL" });
  return { memory, sent: test.sent, ...rendered };
}

// Sends the call shown, once the person has seen what it sends.
async function send(user: UserEvent): Promise<void> {
  await screen.findByRole("region", { name: "What will be sent" });
  await user.click(screen.getByRole("button", { name: "Send" }));
}

// Sends the call shown once it is the one expected, as the last call's screen stays up while that call runs.
async function sendFor(user: UserEvent, call: RegExp): Promise<void> {
  await within(await screen.findByRole("region", { name: "What will be sent" })).findByText(call);
  await user.click(screen.getByRole("button", { name: "Send" }));
}

// Starts the diagnostic from SQL's page and sends its first call.
async function start(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole("link", { name: AI_LED }));
  await user.click(await screen.findByRole("button", { name: "Start" }));
  await send(user);
}

describe("taking an AI-led diagnostic (MVP S21.1, S23)", () => {
  it("is offered only once a model is set up (S21.1)", async () => {
    const user = userEvent.setup();
    await onSkill(user, { model: false });
    expect(screen.queryByRole("link", { name: AI_LED })).toBeNull();

    await setUpModel(user);
    await user.click(await navLink("Skills"));
    await user.click(await screen.findByRole("link", { name: "SQL" }));
    await screen.findByRole("link", { name: AI_LED });
  });

  it("says how it works, with the model and where it starts, before anything is written or sent (S23.1, S23.2)", async () => {
    const user = userEvent.setup();
    const { container, memory, sent } = await onSkill(user);
    const writes = memory.writes();

    await user.click(screen.getByRole("link", { name: AI_LED }));

    await screen.findByRole("heading", { level: 1, name: "SQL AI-led diagnostic" });
    screen.getByText(/you see exactly what will be sent/i);
    screen.getByText(/two-right-to-settle@1/);
    screen.getByText(/It starts at Working/);
    screen.getByText(/claude-test from Anthropic/);
    expect(memory.writes()).toBe(writes);
    expect(sent).toEqual([]);
    await expectNoAxeViolations(container);
  });

  it("shows what each call will send, and sends it only when the person agrees (S23.1)", async () => {
    const user = userEvent.setup();
    const { container, sent } = await onSkill(user);
    await user.click(screen.getByRole("link", { name: AI_LED }));
    await user.click(await screen.findByRole("button", { name: "Start" }));

    const what = await screen.findByRole("region", { name: "What will be sent" });
    within(what).getByText(/Choosing a question/);
    // The skill and the person's level go; evidence linked to other skills doesn't.
    within(what).getByText(/Level 2, self-reported/);
    expect(within(what).queryByText(/Payments API/)).toBeNull();
    within(what).getByText(/characters/);
    within(what).getByText(/claude-test from Anthropic/);
    expect(sent).toEqual([]);
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByText("Question 1");
    expect(sent).toHaveLength(1);
    screen.getByRole("group", { name: /SQL question . at level 2\?/ });
    screen.getByText(/Probes joins/);
    await expectNoAxeViolations(container);
  });

  it("marks a bank question's answer by its key, with no call (S23.2)", async () => {
    const user = userEvent.setup();
    const { sent } = await onSkill(user);
    await start(user);
    await user.click(await screen.findByRole("radio", { name: RIGHT }));
    await user.click(screen.getByRole("button", { name: "Answer" }));

    // The next call shown chooses the next question; nothing was sent to mark the answer.
    const next = await screen.findByRole("region", { name: "What will be sent" });
    within(next).getByText(/Choosing a question/);
    expect(sent).toHaveLength(1);
  });

  it("marks a written answer only once the person agrees to send it (S23.1, S23.2)", async () => {
    const user = userEvent.setup();
    const { container, sent } = await onSkill(user, { answers: { diagnostic: { written: true } } });
    await start(user);
    await screen.findByText(WRITTEN.prompt);
    await expectNoAxeViolations(container);

    await user.type(screen.getByLabelText("Your answer"), "Rows with no match on the right.");
    await user.click(screen.getByRole("button", { name: "Answer" }));
    const marking = await screen.findByRole("region", { name: "What will be sent" });
    within(marking).getByText(/Marking your answer/);
    within(marking).getByText(/Rows with no match on the right\./);
    expect(sent).toHaveLength(1);

    await send(user);
    await screen.findByText(/Choosing a question/);
    expect(sent).toHaveLength(2);
  });

  it("gives the level by the published rule with the model's explanation, labelled, and writes it with no acceptance step (S23.3, S23.4)", async () => {
    const user = userEvent.setup();
    const { container, memory } = await onSkill(user, { memory: fullProfile(4) });
    await start(user);
    for (let question = 1; question <= 2; question++) {
      await user.click(await screen.findByRole("radio", { name: RIGHT }));
      await user.click(screen.getByRole("button", { name: "Answer" }));
      await send(user);
    }
    // The rule settled it; the last call explains it.
    await screen.findByRole("heading", { level: 1, name: "Your SQL result" });

    const result = screen.getByRole("region", { name: "The result" });
    within(result).getByText("AI correlated");
    within(result).getByText(/Expert/);
    screen.getByText(DIAGNOSTIC_EXPLANATION.showed);
    screen.getByText(DIAGNOSTIC_EXPLANATION.next_step);
    screen.getByText(/Explained by anthropic\/claude-test/);
    screen.getByText(/The level comes from the published rule, not the model/);
    screen.getByText(/can be wrong/i);
    // What it considered, and how each answer was marked (S23.3).
    screen.getByText("Your level: Expert (4), Self-reported, since 2026-10-03");
    expect(screen.getAllByText("Marked by its answer key")).toHaveLength(2);
    const record = await fileContaining(memory, "type: ai-led");
    expect(record).toContain("result: 4");
    expect(record).toContain("explain-diagnostic@1");
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole("link", { name: "Activity log" }));
    await screen.findAllByRole("heading", { name: "Choosing a diagnostic question" });
    screen.getByRole("heading", { name: "Explaining a diagnostic's result" });
    expect(screen.getAllByText(/used in the diagnostic, with no step to accept/)).toHaveLength(3);
  });

  it("labels each question with the model that chose it, where it came from and why (hard rule 6)", async () => {
    const user = userEvent.setup();
    await onSkill(user);
    await start(user);

    await screen.findByText("Question 1");
    screen.getByText("Chosen by anthropic/claude-test");
    screen.getByText("From Pharoam's reviewed questions");
    screen.getByText(/Why this question: Probes joins/);
    screen.getByText("Chosen by AI, which can be wrong.");
  });

  it("goes on after leaving, from where it was, and can be abandoned from there (S23.5)", async () => {
    const user = userEvent.setup();
    await onSkill(user);
    await start(user);
    await screen.findByText("Question 1");
    const question = screen.getByRole("group").getAttribute("aria-label") ?? "";

    await user.click(screen.getByRole("link", { name: "Leave for now" }));
    await user.click(await screen.findByRole("link", { name: "Continue the AI-led diagnostic" }));
    screen.getByText(/goes on with anthropic\/claude-test, the model it started with, from Working/);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Question 1");
    expect(screen.getByRole("group").getAttribute("aria-label") ?? "").toBe(question);

    await user.click(screen.getByRole("link", { name: "Leave for now" }));
    await user.click(await screen.findByRole("link", { name: "Continue the AI-led diagnostic" }));
    await user.click(await screen.findByRole("button", { name: "Abandon it" }));
    await user.click(await screen.findByRole("button", { name: "Abandon the diagnostic" }));
    await screen.findByRole("link", { name: AI_LED });
  });

  it("tries a failed call again when asked, and goes on once it works", async () => {
    const user = userEvent.setup();
    const { container, sent } = await onSkill(user, { answers: { failFirst: 1 } });
    await start(user);
    await screen.findByRole("alert");
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole("button", { name: "Try again" }));

    await screen.findByText("Question 1");
    expect(sent).toHaveLength(2);
  });

  it("shows a written answer marked by the model, labelled with it and why", async () => {
    const user = userEvent.setup();
    await onSkill(user, { answers: { diagnostic: { written: true, right: false } }, memory: fullProfile(0) });
    await start(user);
    // Wrong twice at level 0 settles it there.
    for (let question = 1; question <= 2; question++) {
      await user.type(await screen.findByLabelText("Your answer"), "Not sure.");
      await user.click(screen.getByRole("button", { name: "Answer" }));
      await sendFor(user, /Marking your answer/);
      await sendFor(user, question === 1 ? /Choosing a question/ : /Explaining the result/);
    }

    await screen.findByRole("heading", { level: 1, name: "Your SQL result" });
    expect(screen.getAllByText("Marked by anthropic/claude-test")).toHaveLength(2);
    expect(screen.getAllByText(/Why: Says nothing of unmatched rows/)).toHaveLength(2);
    expect(screen.getAllByText("Written by the model")).toHaveLength(2);
  });

  it("says when a call failed and lets the person try it again", async () => {
    const user = userEvent.setup();
    const offline: ProviderError = { kind: "unreachable" };
    await onSkill(user, { answers: { failFor: { word: "self-reported", error: offline } } });
    await start(user);

    await screen.findByRole("alert");
    screen.getByRole("button", { name: "Try again" });
  });
});
