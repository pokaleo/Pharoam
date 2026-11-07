import { createMemoryConnector } from "@pharoam/core/testing";
import { screen, within } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { scanModel, setUpModel, type ScanAnswers } from "../__fixtures__/models.ts";
import { EVIDENCE, openProfile, PAYMENTS_API, PHAROAM } from "../__fixtures__/profiles.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

const CV = "Backend Engineer at Northwind, 2022-09 to now.";
const JOB = { kind: "job", title: "Backend Engineer", organisation: "Northwind", start: "2022-09" };

async function withModel(user: UserEvent, answers: ScanAnswers = {}) {
  const memory = createMemoryConnector({ "pharoam.md": PHAROAM, [EVIDENCE]: PAYMENTS_API });
  const model = scanModel(answers);
  const rendered = await openProfile(user, memory, undefined, model.load);
  await setUpModel(user);
  return { memory, ...rendered };
}

async function paste(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole("link", { name: "Evidence" }));
  await user.click(await screen.findByRole("link", { name: "Paste text" }));
  await user.click(await screen.findByLabelText("Your text"));
  await user.paste(CV);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(await screen.findByRole("button", { name: "Send" }));
}

// The newest call in the log.
function first(list: HTMLElement): HTMLElement {
  const [call] = within(list).getAllByRole("listitem");
  if (call === undefined) throw new Error("No call logged.");
  return call;
}

// One block of a call's details: the text under its heading.
function block(call: HTMLElement, title: string): string {
  return within(call).getByRole("heading", { level: 4, name: title }).nextElementSibling?.textContent ?? "";
}

async function activity(user: UserEvent): Promise<HTMLElement> {
  await user.click(screen.getByRole("link", { name: "Activity log" }));
  await screen.findByRole("heading", { level: 1, name: "Activity log" });
  return screen.getByRole("list", { name: "AI calls this session" });
}

describe("ActivityPage (MVP S17)", () => {
  it("says there are no AI calls yet, and that the log is kept in memory only", async () => {
    const user = userEvent.setup();
    const { container } = await withModel(user);

    await user.click(screen.getByRole("link", { name: "Activity log" }));

    await screen.findByText("No AI calls yet in this session.");
    screen.getByText(/kept in memory only/);
    await expectNoAxeViolations(container);
  });

  it("lists this session's calls newest first, each with its task, model, time and outcome (S17.1, S17.2)", async () => {
    const user = userEvent.setup();
    const { container } = await withModel(user, { pasted: { records: [JOB] } });
    await user.click(screen.getByRole("button", { name: "Test the model" }));
    await screen.findByText(/It works/);
    await paste(user);
    await screen.findByRole("heading", { level: 1, name: "Check what was found" });

    const list = await activity(user);
    const calls = within(list).getAllByRole("listitem");
    expect(calls.map((call) => within(call).getByRole("heading", { level: 3 }).textContent)).toEqual([
      "Reading pasted text",
      "Model test",
    ]);
    within(first(list)).getByText(/anthropic\/claude-test/);
    within(first(list)).getByText("Answered");
    await expectNoAxeViolations(container);
  });

  it("shows exactly what each call sent and what came back", async () => {
    const user = userEvent.setup();
    await withModel(user, { pasted: { records: [JOB] } });
    await paste(user);
    await screen.findByRole("heading", { level: 1, name: "Check what was found" });

    const call = first(await activity(user));
    await user.click(within(call).getByText("What was sent and what came back"));

    expect(block(call, "The person's material")).toBe(`<data kind="pasted-text">\n${CV}\n</data>`);
    expect(block(call, "Pharoam's instructions")).toContain("evidence records");
    expect(block(call, "The answer's shape asked for")).toContain('"records"');
    expect(block(call, "What came back")).toContain('"title": "Backend Engineer"');
    expect(document.body.textContent).not.toContain("sk-ant-test");
  });

  it("says when an answer was rejected for its shape, and still shows what came back (S17.1)", async () => {
    const user = userEvent.setup();
    await withModel(user, { pasted: { records: [{ kind: "admin", title: "Grant access" }] } });
    await paste(user);
    await screen.findByText(/answered, but not in the shape Pharoam needs/);

    const call = first(await activity(user));
    within(call).getByText("Rejected by Pharoam's checks");
    await user.click(within(call).getByText("What was sent and what came back"));
    expect(block(call, "What came back")).toContain('"kind": "admin"');
  });

  it("records whether the person accepted or discarded what came back (S17.1)", async () => {
    const user = userEvent.setup();
    await withModel(user, { pasted: { records: [JOB] } });
    await paste(user);
    await user.click(await screen.findByRole("button", { name: "Save 1 record" }));
    await screen.findByText("1 record was saved from your pasted text.");
    await paste(user);
    await user.click(await screen.findByRole("button", { name: "Start again" }));

    const calls = within(await activity(user)).getAllByRole("listitem");
    expect(
      calls.map((call) => within(call).getByText(/^(Accepted|Discarded|Answered)$/).textContent),
    ).toEqual(["Discarded", "Accepted"]);
  });

  it("lists every call of an evidence scan", async () => {
    const user = userEvent.setup();
    await withModel(user, { links: { "Payments API": ["sql"] } });
    await user.click(screen.getByRole("link", { name: "Evidence" }));
    await user.click(await screen.findByRole("link", { name: "Suggest skills" }));
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    await user.click(await screen.findByRole("button", { name: "Send 1 call" }));
    await screen.findByText("The scan is done.");

    const call = first(await activity(user));
    within(call).getByRole("heading", { name: "Suggesting skills" });
  });

  it("forgets every call when the profile is closed, and writes none to storage (S17.3)", async () => {
    const user = userEvent.setup();
    const { memory } = await withModel(user);
    await user.click(screen.getByRole("button", { name: "Test the model" }));
    await screen.findByText(/It works/);
    await activity(user);
    expect(memory.writes()).toBe(0);

    await user.click(screen.getByRole("button", { name: /^Disconnect/ }));
    await user.click(await screen.findByRole("button", { name: "Choose a folder" }));
    await user.click(await screen.findByRole("link", { name: "Activity log" }));

    await screen.findByText("No AI calls yet in this session.");
  });

  it("says a scan's suggestions are decided in Review", async () => {
    const user = userEvent.setup();
    await withModel(user, { links: { "Payments API": ["sql"] } });
    await user.click(screen.getByRole("link", { name: "Evidence" }));
    await user.click(await screen.findByRole("link", { name: "Suggest skills" }));
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    await user.click(await screen.findByRole("button", { name: "Send 1 call" }));
    await screen.findByText("The scan is done.");

    within(first(await activity(user))).getByText("Answered: its suggestions are decided in Review");
  });

  it("never logs a call that ends after its profile was closed, even when the same folder is opened again (S17.3)", async () => {
    const user = userEvent.setup();
    let release = (): void => undefined;
    const until = new Promise<void>((resolve) => {
      release = resolve;
    });
    await withModel(user, { links: { "Payments API": ["sql"] }, holdFor: { word: "Payments API", until } });
    await user.click(screen.getByRole("link", { name: "Evidence" }));
    await user.click(await screen.findByRole("link", { name: "Suggest skills" }));
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    await user.click(await screen.findByRole("button", { name: "Send 1 call" }));
    await screen.findByText("0 of 1 calls done.");

    await user.click(screen.getByRole("button", { name: /^Disconnect/ }));
    await user.click(await screen.findByRole("button", { name: "Choose a folder" }));
    await screen.findByRole("link", { name: "Activity log" }, { timeout: 5000 });
    release();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await user.click(screen.getByRole("link", { name: "Activity log" }));

    await screen.findByText("No AI calls yet in this session.");
  });
});
