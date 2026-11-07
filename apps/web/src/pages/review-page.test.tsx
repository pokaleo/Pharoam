import { EvidenceRecord, evidenceText, parseRecordFile, sentFingerprint } from "@pharoam/core";
import { createMemoryConnector, type MemoryConnector } from "@pharoam/core/testing";
import { screen, within } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  EVIDENCE,
  EVIDENCE_ID,
  lines,
  openProfile,
  PAYMENTS_API,
  PHAROAM,
} from "../__fixtures__/profiles.ts";
import { expectNoAxeViolations } from "../testing/axe.ts";

const SESSION = "sessions/evidence-scan-2026-11-06--00000030.md";
const LINK_ID = "0192f3a1-0000-7000-8000-000000000031";
const LEVEL_ID = "0192f3a1-0000-7000-8000-000000000032";

// What a scan would have sent about Payments API, as it is now.
function sent(text = PAYMENTS_API): string {
  const file = parseRecordFile(text);
  if (!file.ok) throw new Error("Unreadable evidence.");
  return sentFingerprint(evidenceText(EvidenceRecord.parse(file.value.top), file.value.body));
}

// A scan's session with a suggested link for Payments API and a suggested Python level.
function session(status = "in-progress", decided = ""): string {
  return lines(
    "---",
    "schema: session/1",
    "id: 0192f3a1-0000-7000-8000-000000000030",
    "created: 2026-11-06T10:00:00Z",
    "updated: 2026-11-06T10:01:00Z",
    "workflow: evidence-scan@1",
    "scan: skill-links",
    `status: ${status}`,
    "suggestions:",
    `  - id: ${LINK_ID}`,
    "    kind: skill-link",
    `    evidence: ${EVIDENCE_ID}`,
    `    read: ${sent()}`,
    "    skill: sql",
    "    explanation: Ran the payments database.",
    "    ai: { task: suggest-skill-links@1, model: anthropic/claude-test, at: 2026-11-06T10:00:30Z }",
    ...(decided === "" ? [] : [`    decision: ${decided}`, "    decided_at: 2026-11-06T10:05:00Z"]),
    `  - id: ${LEVEL_ID}`,
    "    kind: skill-level",
    "    skill: python",
    "    level: 3",
    "    explanation: Built and ran the refunds flow in Python.",
    "    limits: Judged from one record only.",
    "    evidence:",
    `      - ${EVIDENCE_ID}`,
    "    read:",
    `      - evidence: ${EVIDENCE_ID}`,
    `        sent: ${sent()}`,
    "    ai: { task: judge-skill-level@1, model: anthropic/claude-test, at: 2026-11-06T10:00:40Z }",
    ...(decided === "" ? [] : [`    decision: ${decided}`, "    decided_at: 2026-11-06T10:05:00Z"]),
    "already:",
    `  - { kind: skill-link, evidence: ${EVIDENCE_ID}, skill: python }`,
    "---",
  );
}

function folder(extra: Readonly<Record<string, string>> = {}): MemoryConnector {
  return createMemoryConnector({
    "pharoam.md": PHAROAM,
    [EVIDENCE]: PAYMENTS_API,
    [SESSION]: session(),
    ...extra,
  });
}

async function review(user: UserEvent, memory = folder()) {
  const rendered = await openProfile(user, memory);
  // The link's name includes how many suggestions wait, such as "Review 2".
  await user.click(screen.getByRole("link", { name: /^Review/ }));
  await screen.findByRole("heading", { level: 1, name: "Review" });
  return { memory, ...rendered };
}

const item = (name: string): HTMLElement => screen.getByRole("article", { name });

// The python skill record's text, wherever the storage put it.
async function pythonText(memory: MemoryConnector): Promise<string> {
  const listed = await memory.connector.list();
  for (const { location } of listed.ok ? listed.value : []) {
    const text = memory.text(location) ?? "";
    if (text.includes("skill: python") && text.includes("schema: skill-record/1")) return text;
  }
  return "";
}

describe("ReviewPage (MVP S16.6, S16.7)", () => {
  it("lists each pending suggestion with its explanation, limits, evidence and model, and counts them in the sidebar", async () => {
    const user = userEvent.setup();
    const { container } = await review(user);

    const link = item("SQL for Payments API");
    within(link).getByText("Ran the payments database.");
    within(link).getByText("AI-suggested");
    within(link).getByText(/anthropic\/claude-test/);
    const level = item("Python: level 3, Proficient");
    within(level).getByText("Built and ran the refunds flow in Python.");
    within(level).getByText("Judged from one record only.");
    within(level).getByRole("link", { name: "Payments API" });
    expect(screen.getByRole("link", { name: /^Review/ }).textContent).toBe("Review 2");
    screen.getByText(/AI can make mistakes/);
    await expectNoAxeViolations(container);
  });

  it("accepts a link: the skill joins the evidence, listed as an AI link the person confirmed (S16.8)", async () => {
    const user = userEvent.setup();
    const { memory } = await review(user);

    await user.click(within(item("SQL for Payments API")).getByRole("button", { name: "Accept" }));

    await screen.findByText("1 accepted.");
    // The card is gone, so focus moves to the page's title rather than being lost.
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Review" }));
    const text = memory.text(EVIDENCE) ?? "";
    expect(text).toContain("  - sql\n");
    expect(text).toContain("ai-skill-links:\n  - skill: sql\n    task: suggest-skill-links@1\n");
    expect(screen.queryByRole("article", { name: "SQL for Payments API" })).toBeNull();
    expect(screen.getByRole("link", { name: /^Review/ }).textContent).toBe("Review 1");
  });

  it("accepts a level: an ai-judged observation citing its evidence (S16.9)", async () => {
    const user = userEvent.setup();
    const { memory } = await review(user);

    await user.click(within(item("Python: level 3, Proficient")).getByRole("button", { name: "Accept" }));

    await screen.findByText("1 accepted.");
    const text = await pythonText(memory);
    expect(text).toContain("provenance: ai-judged");
    expect(text).toContain(`id: ${LEVEL_ID}`);
  });

  it("discards a suggestion, writing nothing else, and skips one, which stays pending and never counts", async () => {
    const user = userEvent.setup();
    const { memory } = await review(user);

    await user.click(within(item("SQL for Payments API")).getByRole("button", { name: "Discard" }));
    await screen.findByText("1 discarded.");
    expect(memory.text(EVIDENCE)).toBe(PAYMENTS_API);
    expect(memory.text(SESSION)).toContain("decision: discarded");

    await user.click(within(item("Python: level 3, Proficient")).getByRole("button", { name: "Skip" }));
    const skipped = screen.getByRole("region", { name: "Skipped for now" });
    within(skipped).getByText("Python: level 3, Proficient");
    expect(await pythonText(memory)).toBe("");
    expect(screen.getByRole("link", { name: /^Review/ }).textContent).toBe("Review 1");
  });

  it("adjusts a level: records the person's own level instead, and drops the suggestion", async () => {
    const user = userEvent.setup();
    const { memory } = await review(user);
    const level = item("Python: level 3, Proficient");

    await user.click(within(level).getByRole("button", { name: "Adjust" }));
    await user.click(within(level).getByRole("radio", { name: /^2/ }));
    await user.click(within(level).getByRole("button", { name: "Record my level" }));

    await screen.findByText("Your own level was recorded instead.");
    const text = await pythonText(memory);
    expect(text).toContain("provenance: self-reported");
    expect(text).not.toContain("ai-judged");
    expect(memory.text(SESSION)).toContain("decision: adjusted");
  });

  it("accepts several at once", async () => {
    const user = userEvent.setup();
    const { memory } = await review(user);

    await user.click(within(item("SQL for Payments API")).getByRole("checkbox", { name: "Select" }));
    await user.click(within(item("Python: level 3, Proficient")).getByRole("checkbox", { name: "Select" }));
    await user.click(screen.getByRole("button", { name: "Accept 2 selected" }));

    await screen.findByText("2 accepted.");
    expect(memory.text(SESSION)).toContain("status: completed");
    screen.getByText("Nothing waits for your review.");
  });

  it("can't accept a suggestion whose evidence changed since the scan read it, only discard it (S16.10)", async () => {
    const user = userEvent.setup();
    await review(user, folder({ [EVIDENCE]: PAYMENTS_API.replace("refunds", "refunds and disputes") }));

    const link = item("SQL for Payments API");
    within(link).getByText(
      "Its evidence changed since the scan read it. Scan it again to get a fresh suggestion.",
    );
    expect(within(link).getByRole("button", { name: "Accept" })).toHaveProperty("disabled", true);
    expect(within(link).getByRole("button", { name: "Discard" })).toHaveProperty("disabled", false);
    expect(within(link).getByRole("link", { name: "Scan it again" }).getAttribute("href")).toMatch(
      new RegExp(`/scan\\?kind=links&only=${EVIDENCE_ID}$`),
    );
  });

  it("lists past scans with what they found, and deletes one after asking (S16.11, S16.14)", async () => {
    const user = userEvent.setup();
    const { memory } = await review(user, folder({ [SESSION]: session("completed", "discarded") }));

    screen.getByText("Nothing waits for your review.");
    const past = screen.getByRole("region", { name: "Past scans" });
    within(past).getByText(/Skill links, 6 November 2026/);
    within(past).getByText("Already so: Python for Payments API.");
    await user.click(within(past).getByRole("button", { name: "Delete" }));
    await user.click(within(past).getByRole("button", { name: "Delete it" }));

    await screen.findByText("The scan's record was deleted.");
    expect(memory.text(SESSION)).toBeUndefined();
  });
});
