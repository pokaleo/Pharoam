import { createMemoryConnector, type MemoryConnector } from "@pharoam/core/testing";
import { screen, within } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { scanModel, setUpModel, type ScanAnswers } from "../__fixtures__/models.ts";
import { EVIDENCE, openProfile, PAYMENTS_API, PHAROAM, lines } from "../__fixtures__/profiles.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

const SHELL_ID = "0192f3a1-0000-7000-8000-000000000005";
const SHELL = lines(
  "---",
  "schema: evidence/1",
  `id: ${SHELL_ID}`,
  "created: 2026-10-04T09:00:00Z",
  "kind: project",
  "title: Shell history search",
  "---",
  "A small tool in Rust.",
);

function folder(): MemoryConnector {
  return createMemoryConnector({
    "pharoam.md": PHAROAM,
    [EVIDENCE]: PAYMENTS_API,
    "evidence/shell-history-search--00000005.md": SHELL,
  });
}

// Opens the profile with the test model set up, then follows a link to a scan.
async function scanFrom(
  user: UserEvent,
  area: string,
  link: string,
  answers: ScanAnswers = { links: { "Payments API": ["sql"], "Shell history": ["rust"] } },
  memory = folder(),
) {
  const model = scanModel(answers);
  const rendered = await openProfile(user, memory, undefined, model.load);
  await setUpModel(user);
  await user.click(screen.getByRole("link", { name: area }));
  await user.click(await screen.findByRole("link", { name: link }));
  return { memory, sent: model.sent, ...rendered };
}

describe("ScanPage: suggesting skill links (MVP S16.1, S16.4, S16.5)", () => {
  it("shows what each call will send and its size, and sends nothing until the person confirms", async () => {
    const user = userEvent.setup();
    const { sent, container, memory } = await scanFrom(user, "Evidence", "Suggest skills");

    await screen.findByRole("heading", { level: 1, name: "Suggest skills" });
    const records = screen.getByRole("group", { name: "Evidence to read" });
    expect(
      within(records)
        .getAllByRole("checkbox")
        .map((box) => (box as HTMLInputElement).checked),
    ).toEqual([true, true]);
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const what = await screen.findByRole("region", { name: "What will be sent" });
    within(what).getByText(/2 calls, one for each piece of evidence/);
    within(what).getByText(/characters in all/);
    within(what).getByText(/claude-test from Anthropic/);
    within(what).getByText("Payments API");
    expect(sent).toEqual([]);
    expect(memory.writes()).toBe(0);
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole("button", { name: "Send 2 calls" }));

    await screen.findByText("The scan is done.");
    screen.getByText("2 suggestions wait for your review.");
    expect(screen.getByRole("link", { name: "Review them" }).getAttribute("href")).toMatch(/\/review$/);
    expect(sent).toHaveLength(2);
    await expectNoAxeViolations(container);
  });

  it("reads only the records the person keeps ticked", async () => {
    const user = userEvent.setup();
    const { sent } = await scanFrom(user, "Evidence", "Suggest skills");
    await screen.findByRole("heading", { level: 1, name: "Suggest skills" });

    await user.click(screen.getByRole("checkbox", { name: "Shell history search" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(await screen.findByRole("button", { name: "Send 1 call" }));

    await screen.findByText("The scan is done.");
    expect(sent).toHaveLength(1);
    expect(sent[0]?.prompt).toContain("Payments API");
  });

  it("starts from one record when asked from its page", async () => {
    const user = userEvent.setup();
    const model = scanModel({ links: { "Payments API": ["sql"] } });
    await openProfile(user, folder(), undefined, model.load);
    await setUpModel(user);
    await user.click(screen.getByRole("link", { name: "Evidence" }));
    await user.click(await screen.findByRole("link", { name: "Payments API" }));
    await user.click(await screen.findByRole("link", { name: "Suggest skills" }));

    const records = await screen.findByRole("group", { name: "Evidence to read" });
    within(records).getByRole("checkbox", { name: "Payments API" });
    expect(within(records).getAllByRole("checkbox")).toHaveLength(1);
  });

  it("can be stopped between calls, keeping what finished", async () => {
    const user = userEvent.setup();
    let release = (): void => undefined;
    const until = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { sent, memory } = await scanFrom(user, "Evidence", "Suggest skills", {
      links: { "Payments API": ["sql"], "Shell history": ["rust"] },
      holdFor: { word: "Payments API", until },
    });
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    await user.click(await screen.findByRole("button", { name: "Send 2 calls" }));

    await screen.findByText("0 of 2 calls done.");
    await user.click(screen.getByRole("button", { name: "Stop" }));
    release();

    await screen.findByText("The scan was stopped. What finished is kept.");
    expect(sent).toHaveLength(1);
    const listed = await memory.connector.list();
    const kept = listed.ok ? listed.value.find((ref) => ref.location.startsWith("session/")) : undefined;
    expect(memory.text(kept?.location ?? "")).toContain("skill: sql");
  });

  it("sets aside a record whose call fails, and says why", async () => {
    const user = userEvent.setup();
    await scanFrom(user, "Evidence", "Suggest skills", {
      links: { "Shell history": ["rust"] },
      failFor: { word: "Payments API", error: { kind: "unreachable" } },
    });
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    await user.click(await screen.findByRole("button", { name: "Send 2 calls" }));

    await screen.findByText("The scan is done.");
    screen.getByText("Set aside: Payments API, because the provider couldn't be reached.");
    screen.getByText("1 suggestion waits for your review.");
  });

  it("sets aside a record whose provider code breaks, instead of waiting forever, and carries on", async () => {
    const user = userEvent.setup();
    await scanFrom(user, "Evidence", "Suggest skills", {
      links: { "Payments API": ["sql"] },
      throwFor: "Shell history",
    });
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    await user.click(await screen.findByRole("button", { name: "Send 2 calls" }));

    await screen.findByText("The scan is done.");
    screen.getByText("Set aside: Shell history search, because the provider reported a problem.");
  });

  it("offers to set up a model when none is set up, and sends nothing", async () => {
    const user = userEvent.setup();
    const model = scanModel();
    await openProfile(user, folder(), "Evidence", model.load);
    await user.click(await screen.findByRole("link", { name: "Suggest skills" }));

    await screen.findByText("Suggesting skills and levels needs a model of your choice.");
    screen.getByRole("link", { name: "Set up a model in Settings" });
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
  });
});

describe("ScanPage: judging levels (MVP S16.2)", () => {
  it("offers only skills with linked evidence, and sends each its linked evidence only", async () => {
    const user = userEvent.setup();
    const { sent } = await scanFrom(user, "Skills", "Ask AI for levels", { level: 3 });

    const skills = await screen.findByRole("group", { name: "Skills to judge" });
    within(skills).getByRole("checkbox", { name: "Python" });
    expect(within(skills).getAllByRole("checkbox")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    within(await screen.findByRole("region", { name: "What will be sent" })).getByText(
      /1 call, one for each skill, with its linked evidence only/,
    );
    await user.click(screen.getByRole("button", { name: "Send 1 call" }));

    await screen.findByText("1 suggestion waits for your review.");
    expect(sent[0]?.prompt).toContain("Payments API");
    expect(sent[0]?.prompt).not.toContain("Shell history");
  });

  it("never brings back a profile closed while its scan was still running", async () => {
    const user = userEvent.setup();
    let release = (): void => undefined;
    const until = new Promise<void>((resolve) => {
      release = resolve;
    });
    await scanFrom(user, "Evidence", "Suggest skills", {
      links: { "Payments API": ["sql"] },
      holdFor: { word: "Payments API", until },
    });
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    await user.click(await screen.findByRole("button", { name: "Send 2 calls" }));
    await screen.findByText("0 of 2 calls done.");

    await user.click(screen.getByRole("button", { name: /^Disconnect/ }));
    await screen.findByRole("button", { name: "Choose a folder" });
    release();
    await new Promise((resolve) => setTimeout(resolve, 50));

    screen.getByRole("button", { name: "Choose a folder" });
    expect(screen.queryByRole("link", { name: "Profile" })).toBeNull();
  });
});
