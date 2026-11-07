import type { MemoryConnector } from "@pharoam/core/testing";
import { screen, within } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { scanModel, setUpModel, type ScanAnswers } from "../__fixtures__/models.ts";
import { fileContaining, fullProfile, navLink, openProfile } from "../__fixtures__/profiles.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

// The person's own Beginner SQL, citing Payments API, is below what backend engineer asks.
async function withModel(user: UserEvent, answers: ScanAnswers = {}) {
  const memory = fullProfile(2);
  const model = scanModel(answers);
  const rendered = await openProfile(user, memory, undefined, model.load);
  await setUpModel(user);
  await toGap(user);
  return { memory, sent: model.sent, ...rendered };
}

async function toGap(user: UserEvent): Promise<void> {
  await user.click(await navLink("Pathways"));
  await user.click(await screen.findByRole("link", { name: "Backend engineer" }));
  await user.click(await screen.findByRole("link", { name: "See my gap to this pathway" }));
  await screen.findByRole("heading", { level: 1, name: "Your gap to Backend engineer" });
}

const card = (): HTMLElement => screen.getByRole("region", { name: "What this gap might mean" });

// Asks for an explanation and sends what is shown.
async function ask(user: UserEvent): Promise<void> {
  await user.click(within(card()).getByRole("button", { name: /^(Explain this gap|Ask again)$/ }));
  await user.click(await within(card()).findByRole("button", { name: "Send" }));
  await within(card()).findByText(/^By \S*claude-test\./);
}

// How many notes storage holds.
async function noteCount(memory: MemoryConnector): Promise<number> {
  const listed = await memory.connector.list();
  let count = 0;
  for (const ref of listed.ok ? listed.value : [])
    if (((await memory.readOutside(ref.location)) ?? "").includes("schema: note/1")) count += 1;
  return count;
}

// The activity log's entry for the gap explanation.
async function loggedExplanation(user: UserEvent): Promise<string> {
  await user.click(screen.getByRole("link", { name: "Activity log" }));
  const items = await screen.findAllByRole("listitem");
  return items.find((item) => item.textContent.includes("Explaining a gap"))?.textContent ?? "";
}

// The note's text, if one was written.
async function notes(memory: MemoryConnector): Promise<string | undefined> {
  const text = await fileContaining(memory, "schema: note/1");
  return text === "" ? undefined : text;
}

describe("what a gap might mean (MVP S18)", () => {
  it("offers to set up a model when there is none, and sends nothing", async () => {
    const user = userEvent.setup();
    await openProfile(user, fullProfile(2));
    await toGap(user);

    within(card()).getByRole("link", { name: "Set up a model" });
    expect(within(card()).queryByRole("button")).toBeNull();
  });

  it("shows what will be sent, and its size, before anything is sent (S18.1)", async () => {
    const user = userEvent.setup();
    const { container, sent } = await withModel(user);
    const before = sent.length;

    await user.click(within(card()).getByRole("button", { name: "Explain this gap" }));

    const what = await within(card()).findByRole("region", { name: "What will be sent" });
    within(what).getByText(/Backend engineer, its requirements and Pharoam's instructions/);
    const gap = within(what).getByRole("heading", { name: /Where you stand/ }).nextElementSibling;
    expect(gap?.textContent).toContain("Requirement: sql\nLevel: 2, self-reported\nGroup: below");
    expect(gap?.textContent).toContain('"Payments API"');
    within(what).getByText(/characters in all/);
    within(what).getByText(/claude-test from Anthropic/);
    expect(sent).toHaveLength(before);
    await expectNoAxeViolations(container);
  });

  it("shows the answer labelled with its model and the disclaimer, naming only the pathway's requirements, with no score (S18.2)", async () => {
    const user = userEvent.setup();
    const { container, memory } = await withModel(user);

    await ask(user);

    within(card()).getByText("Your SQL is a start; most of the pathway isn't in your profile yet.");
    within(card()).getByRole("heading", { name: "Places to start" });
    within(card()).getByText("Python");
    within(card()).getByText(/AI can make mistakes/);
    within(card()).getByText(/AI-written/);
    expect(card().textContent).not.toMatch(/score|%|\btotal\b|rank|confidence/i);
    expect(await notes(memory)).toBeUndefined();
    await expectNoAxeViolations(container);
  });

  it("refuses an answer that names a skill the pathway doesn't ask for, and writes nothing", async () => {
    const user = userEvent.setup();
    const { memory } = await withModel(user, {
      gap: { meaning: "Learn this.", starts: [{ skill: "cobol", why: "Popular." }] },
    });

    await user.click(within(card()).getByRole("button", { name: "Explain this gap" }));
    await user.click(await within(card()).findByRole("button", { name: "Send" }));

    await within(card()).findByText(/not in the shape Pharoam needs/);
    within(card()).getByRole("button", { name: "Explain this gap" });
    expect(await notes(memory)).toBeUndefined();
  });

  it("accepts the explanation as a note, written with its disclaimer, the pathway pinned and the gap's time (S18.3, S18.4)", async () => {
    const user = userEvent.setup();
    const { memory } = await withModel(user);
    await ask(user);

    await user.click(within(card()).getByRole("button", { name: "Accept as a note" }));

    await within(card()).findByText(/^Saved as a note in /);
    const text = (await notes(memory)) ?? "";
    expect(text).toMatch(/pathway: pharoam-core@\d+\.\d+\.\d+:backend-engineer\n/);
    expect(text).toMatch(/gap_updated: \S+\n/);
    expect(text).toMatch(/task: explain-gap@1/);
    expect(text).toContain("> ⚠️ AI-generated explanation of a gap, accepted by you.");
    expect(text).toContain(
      "### Places to start\n\n- **Python**: It is core, and nothing in your profile shows it yet.",
    );
    within(card()).getByText(/^Accepted .* by \S*claude-test/);

    await user.click(screen.getByRole("link", { name: "Activity log" }));
    const call = (await screen.findAllByRole("listitem")).find((item) =>
      item.textContent.includes("Explaining a gap"),
    );
    expect(call?.textContent).toContain("Accepted");
  });

  it("saves the explanation as the person edited it", async () => {
    const user = userEvent.setup();
    const { memory } = await withModel(user);
    await ask(user);

    await user.click(within(card()).getByRole("button", { name: "Edit" }));
    const field = within(card()).getByLabelText("The explanation, as it will be saved");
    await user.clear(field);
    await user.type(field, "Start with Python, in my own words.");
    await user.click(within(card()).getByRole("button", { name: "Accept as a note" }));

    await within(card()).findByText(/^Saved as a note in /);
    expect(await notes(memory)).toContain("\n\nStart with Python, in my own words.\n");
  });

  it("discards the explanation, writing nothing", async () => {
    const user = userEvent.setup();
    const { memory } = await withModel(user);
    await ask(user);

    await user.click(within(card()).getByRole("button", { name: "Discard" }));

    within(card()).getByRole("button", { name: "Explain this gap" });
    expect(within(card()).queryByText(/Your SQL is a start/)).toBeNull();
    expect(await notes(memory)).toBeUndefined();
    await user.click(screen.getByRole("link", { name: "Activity log" }));
    const call = (await screen.findAllByRole("listitem")).find((item) =>
      item.textContent.includes("Explaining a gap"),
    );
    expect(call?.textContent).toContain("Discarded");
  });

  it("shows the latest note on coming back, and says so once the profile has changed since (S18.5)", async () => {
    const user = userEvent.setup();
    await withModel(user);
    await ask(user);
    await user.click(within(card()).getByRole("button", { name: "Accept as a note" }));
    await within(card()).findByText(/^Saved as a note in /);

    await toGap(user);
    await within(card()).findByText("Your SQL is a start; most of the pathway isn't in your profile yet.");
    expect(within(card()).queryByText(/changed since/)).toBeNull();
    within(card()).getByRole("button", { name: "Ask again" });

    // The person rates another of the pathway's skills, so the gap moves on. Times are written to the second, so
    // the change comes in a later second than the gap the note explained, as it always would by hand.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const [rate] = within(screen.getByRole("region", { name: /^Unknown\b/ })).getAllByRole("link", {
      name: "Say where you stand",
    });
    if (rate === undefined) throw new Error("Nothing to rate.");
    await user.click(rate);
    await user.click(await screen.findByRole("radio", { name: /^Beginner/ }));
    await user.click(screen.getByRole("button", { name: "Record my level" }));
    await screen.findByText(/Beginner/, { selector: "[data-shown-level]" });
    await toGap(user);

    await within(card()).findByText(/Your profile has changed since this explanation/);
  });

  it("says why when the call fails, and writes nothing", async () => {
    const user = userEvent.setup();
    const { memory } = await withModel(user, {
      failFor: { word: "Payments API", error: { kind: "unreachable" } },
    });

    await user.click(within(card()).getByRole("button", { name: "Explain this gap" }));
    await user.click(await within(card()).findByRole("button", { name: "Send" }));

    await within(card()).findByRole("button", { name: "Explain this gap" });
    expect(within(card()).getByRole("alert").textContent).not.toBe("");
    expect(await notes(memory)).toBeUndefined();
  });

  it("saves one note however often Accept is pressed", async () => {
    const user = userEvent.setup();
    const { memory } = await withModel(user);
    await ask(user);

    await user.dblClick(within(card()).getByRole("button", { name: "Accept as a note" }));

    await within(card()).findByText(/^Saved as a note in /);
    expect(await noteCount(memory)).toBe(1);
  });

  it("moves focus to each step, and announces the answer and the save", async () => {
    const user = userEvent.setup();
    await withModel(user);

    await user.click(within(card()).getByRole("button", { name: "Explain this gap" }));
    expect(document.activeElement).toBe(
      await within(card()).findByRole("heading", { name: "What will be sent" }),
    );
    await user.click(within(card()).getByRole("button", { name: "Send" }));
    await within(card()).findByText(/^By \S*claude-test\./);
    const title = within(card()).getByRole("heading", { level: 2, name: "What this gap might mean" });
    expect(document.activeElement).toBe(title);
    expect(within(card()).getByRole("status").textContent).toBe(
      "The explanation is ready. Nothing is saved yet.",
    );

    await user.click(within(card()).getByRole("button", { name: "Accept as a note" }));
    await within(card()).findByText(/^Saved as a note in /);
    expect(within(card()).getAllByRole("status")).toHaveLength(1);
    expect(document.activeElement).toBe(title);
  });

  it("sends nothing when the person cancels", async () => {
    const user = userEvent.setup();
    const { sent } = await withModel(user);
    const before = sent.length;

    await user.click(within(card()).getByRole("button", { name: "Explain this gap" }));
    await user.click(await within(card()).findByRole("button", { name: "Cancel" }));

    within(card()).getByRole("button", { name: "Explain this gap" });
    expect(sent).toHaveLength(before);
  });

  it("refuses to save an explanation edited down to nothing", async () => {
    const user = userEvent.setup();
    const { memory } = await withModel(user);
    await ask(user);

    await user.click(within(card()).getByRole("button", { name: "Edit" }));
    await user.clear(within(card()).getByLabelText("The explanation, as it will be saved"));
    await user.click(within(card()).getByRole("button", { name: "Accept as a note" }));

    await within(card()).findByText("The explanation is empty. Write something, or discard it.");
    expect(await noteCount(memory)).toBe(0);
  });

  it("counts an answer left without a decision as discarded (S17.1)", async () => {
    const user = userEvent.setup();
    const { memory } = await withModel(user);
    await ask(user);

    expect(await loggedExplanation(user)).toContain("Discarded");
    expect(await noteCount(memory)).toBe(0);
  });

  it("keeps the model's text from breaking the note's structure", async () => {
    const user = userEvent.setup();
    const { memory } = await withModel(user, {
      gap: {
        meaning: "# Ready now\nYou could start soon.",
        starts: [{ skill: "python", why: "Core.\n\n# Ready for a senior role" }],
      },
    });
    await ask(user);

    expect(within(card()).queryByRole("heading", { level: 1 })).toBeNull();
    await user.click(within(card()).getByRole("button", { name: "Accept as a note" }));
    await within(card()).findByText(/^Saved as a note in /);
    const text = (await notes(memory)) ?? "";
    expect(text).toContain("- **Python**: Core. # Ready for a senior role\n");
    expect(text).not.toMatch(/^# /m);
  });
});
