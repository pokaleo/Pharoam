import { screen, within } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createMemoryConnector } from "@pharoam/core/testing";
import {
  EVIDENCE,
  EVIDENCE_ID,
  fullProfile,
  lines,
  OBSERVATION_ID,
  openProfile,
  PAYMENTS_API,
  PHAROAM,
  SQL,
  SQL_OBSERVATION,
} from "../__fixtures__/profiles.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

async function openSql(user: UserEvent, memory = fullProfile()) {
  const rendered = await openProfile(user, memory, "Skills");
  await user.click(await screen.findByRole("link", { name: "SQL" }));
  await screen.findByRole("heading", { level: 1, name: "SQL" });
  return { memory, ...rendered };
}

describe("SkillPage (MVP S7)", () => {
  it("shows the skill's one level and where it came from (MVP S9.1)", async () => {
    const user = userEvent.setup();
    const { container } = await openSql(user);

    const shown = screen.getByText(/Working/, { selector: "[data-shown-level]" });
    const panel = shown.closest("section");
    if (panel === null) throw new Error("expected the shown level's panel");
    within(panel).getByText("Self-reported");
    within(panel).getByText("since 3 Oct 2026");
    within(panel).getByText("skills/sql.md");
    await expectNoAxeViolations(container);
  });

  it("appends a correction that supersedes the old level, leaving it as written (S7.1)", async () => {
    const user = userEvent.setup();
    const { memory } = await openSql(user);

    await user.click(screen.getByRole("button", { name: "Correct Working, 3 Oct 2026" }));
    await user.click(screen.getByRole("radio", { name: /^Beginner/ }));
    await user.click(screen.getByRole("button", { name: "Save the correction" }));

    await screen.findByText(/Beginner/, { selector: "[data-shown-level]" });
    const text = (await memory.readOutside(SQL)) ?? "";
    expect(text).toContain(SQL_OBSERVATION(2, true));
    expect(text).toContain(`supersedes: ${OBSERVATION_ID}`);
  });

  it("appends a retraction, so the level stops counting (S7.2)", async () => {
    const user = userEvent.setup();
    const { memory, container } = await openSql(user);

    await user.click(screen.getByRole("button", { name: "Retract Working, 3 Oct 2026" }));
    await user.type(screen.getByLabelText(/Why/), "Rated too high");
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole("button", { name: "Retract it" }));

    await screen.findByText("No level counts for this skill now.");
    const text = (await memory.readOutside(SQL)) ?? "";
    expect(text).toContain(SQL_OBSERVATION(2, true));
    expect(text).toMatch(new RegExp(`target: ${OBSERVATION_ID}\\n\\s+decision: retract`));
    expect(text).toContain("note: Rated too high");
  });

  it("shows every entry newest first, marking corrected, shown and hand-edited ones (S7.3, S12.3)", async () => {
    const user = userEvent.setup();
    const { container } = await openSql(user);
    await user.click(screen.getByRole("button", { name: "Correct Working, 3 Oct 2026" }));
    await user.click(screen.getByRole("radio", { name: /^Proficient/ }));
    await user.click(screen.getByRole("button", { name: "Save the correction" }));
    await screen.findByText(/Proficient/, { selector: "[data-shown-level]" });

    const history = screen.getByRole("list", { name: "Skill history" });
    const [newest, older] = within(history).getAllByRole("listitem");
    if (newest === undefined || older === undefined) throw new Error("expected two entries");
    within(newest).getByText("Proficient");
    within(newest).getByText("Shown");
    within(older).getByText("Working");
    within(older).getByText("Corrected");
    within(older).getByText(/Cites Payments API/);
    // Written by hand in the test's file, without Pharoam's fingerprint.
    within(older).getByText("Edited outside Pharoam");
    // A corrected level no longer counts, so there is nothing to correct or retract on it.
    expect(within(older).queryByRole("button")).toBeNull();
    await expectNoAxeViolations(container);
  });
});

describe("asking AI for a skill's level (MVP S16.2, S16.12)", () => {
  // A Python skill record with an accepted AI level, judged at the given time from Payments API.
  const judged = (at: string): string =>
    lines(
      "---",
      "schema: skill-record/1",
      "id: 0192f3a1-0000-7000-8000-000000000040",
      "created: 2026-10-01T09:00:00Z",
      "skill: python",
      "entries:",
      "  - id: 0192f3a1-0000-7000-8000-000000000041",
      "    level: 3",
      "    provenance: ai-judged",
      `    observed_at: ${at}`,
      "    evidence:",
      `      - ${EVIDENCE_ID}`,
      "    explanation: Built the refunds flow in Python.",
      "    limits: One record only.",
      `    ai: { task: judge-skill-level@1, model: anthropic/claude-test, at: "${at}", confirmed_by_user: "${at}" }`,
      "---",
    );

  async function python(user: UserEvent, at: string) {
    const memory = createMemoryConnector({
      "pharoam.md": PHAROAM,
      [EVIDENCE]: PAYMENTS_API,
      "skills/python.md": judged(at),
    });
    await openProfile(user, memory, "Skills");
    await user.click(await screen.findByRole("link", { name: "Python" }));
    await screen.findByRole("heading", { level: 1, name: "Python" });
  }

  it("offers to ask AI for the level of a skill with linked evidence", async () => {
    const user = userEvent.setup();
    await python(user, "2026-10-05T09:00:00Z");

    const ask = screen.getByRole("link", { name: "Ask AI for its level" });
    expect(ask.getAttribute("href")).toMatch(/\/scan\?kind=levels&only=python$/);
    expect(screen.queryByText(/has changed since it was judged/)).toBeNull();
  });

  it("offers to ask AI again once the evidence behind an accepted AI level changes, and never judges on its own", async () => {
    const user = userEvent.setup();
    await python(user, "2026-10-01T10:00:00Z");

    screen.getByText(/The evidence behind your AI level has changed since it was judged/);
    expect(screen.getByRole("link", { name: "Ask AI again" }).getAttribute("href")).toMatch(
      /\/scan\?kind=levels&only=python$/,
    );
  });

  it("doesn't offer to ask AI for a skill no evidence is linked to", async () => {
    const user = userEvent.setup();
    await openSql(user);
    expect(screen.queryByRole("link", { name: /Ask AI/ })).toBeNull();
  });
});
