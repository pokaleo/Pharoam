import type { Route } from "@playwright/test";
import { expect, test } from "./fixtures.ts";
import { PAYMENTS_API, PHAROAM } from "./files.ts";

// Answers for Anthropic's address in its own reply format: a tool call in whichever task's shape was asked for.
async function anthropic(route: Route): Promise<void> {
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
  };
  const request = route.request();
  if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  const body = JSON.parse(request.postData() ?? "{}") as { tools?: { name?: string }[] };
  const task = body.tools?.[0]?.name ?? "";
  const input =
    task === "explain-gap"
      ? {
          meaning: "Little of the pathway is in your profile yet.",
          starts: [{ skill: "python", why: "It is core, and your payments work may already show it." }],
        }
      : task === "judge-skill-level"
        ? {
            level: 3,
            explanation: "Built and ran a payments API.",
            limits: "One record only.",
            evidence: ["E1"],
          }
        : {
            links: [
              { skill: "python", explanation: "The refunds flow was written in Python." },
              { skill: "sql", explanation: "It kept payments in a database." },
            ],
          };
  return route.fulfill({
    headers: cors,
    json: {
      id: "msg_1",
      type: "message",
      role: "assistant",
      model: "claude-test",
      content: [{ type: "tool_use", id: "toolu_1", name: task, input }],
      stop_reason: "tool_use",
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  });
}

test.describe("with Anthropic set up", () => {
  test.use({ provider: "https://api.anthropic.com" });

  test("S16: suggests skills and a level from evidence, and writes only what the person accepts", async ({
    app,
    page,
  }) => {
    await page.route("https://api.anthropic.com/**", anthropic);
    await app.start();
    await app.put("pharoam.md", PHAROAM);
    await app.put("evidence/payments-api--0192f3a1.md", PAYMENTS_API);
    await app.choose();
    await app.nav("Settings").click();
    await page.getByRole("radio", { name: "Anthropic" }).check();
    await page.getByLabel("API key").fill("sk-ant-test");
    await page.getByLabel("Or type a model ID").fill("claude-test");
    await page.getByRole("button", { name: "Use this model" }).click();

    // Skill links, from one record.
    await app.nav("Evidence").click();
    await page.getByRole("link", { name: "Suggest skills" }).click();
    await expect(page.getByRole("group", { name: "Evidence to read" })).toBeVisible();
    await app.expectAccessible("scan, choosing evidence");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("region", { name: "What will be sent" })).toBeVisible();
    await app.expectAccessible("scan, what will be sent");
    await page.getByRole("button", { name: "Send 1 call" }).click();
    await expect(page.getByText("2 suggestions wait for your review.")).toBeVisible();
    await app.expectAccessible("scan, done");
    expect(await app.read("evidence/payments-api--0192f3a1.md")).toBe(PAYMENTS_API);

    await page.getByRole("link", { name: "Review them" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Review" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Review/ })).toHaveText("Review 2");
    await app.expectAccessible("review");
    await page
      .getByRole("article", { name: "Python for Payments API" })
      .getByRole("button", { name: "Accept" })
      .click();
    await expect(page.getByText("1 accepted.")).toBeVisible();
    await page
      .getByRole("article", { name: "SQL for Payments API" })
      .getByRole("button", { name: "Discard" })
      .click();
    await expect(page.getByText("Nothing waits for your review.")).toBeVisible();
    const evidence = (await app.read("evidence/payments-api--0192f3a1.md")) ?? "";
    expect(evidence).toContain("skills:\n  - python\n");
    expect(evidence).toContain("ai-skill-links:\n  - skill: python\n    task: suggest-skill-links@1\n");
    expect(evidence).not.toContain("sql");
    expect(await app.list("sessions")).toHaveLength(1);

    // A level for the skill now linked, from that evidence only.
    await app.nav("Skills").click();
    await page.getByRole("link", { name: "Ask AI for levels" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Send 1 call" }).click();
    await page.getByRole("link", { name: "Review them" }).click();
    await page
      .getByRole("article", { name: "Python: level 3, Proficient" })
      .getByRole("button", { name: "Accept" })
      .click();
    await expect(page.getByText("1 accepted.")).toBeVisible();
    const python = (await app.read("skills/python.md")) ?? "";
    expect(python).toContain("provenance: ai-judged");
    expect(python).toContain("task: judge-skill-level@1");
    expect(python).not.toMatch(/confidence/);

    // Every call so far, newest first, each with what was sent and what came back (S17).
    await app.nav("Activity log").click();
    const calls = page.getByRole("list", { name: "AI calls this session" }).getByRole("listitem");
    await expect(calls).toHaveCount(2);
    await expect(calls.nth(0).getByRole("heading", { level: 3 })).toHaveText("Judging a level");
    await expect(calls.nth(1).getByRole("heading", { level: 3 })).toHaveText("Suggesting skills");
    await calls.nth(1).getByText("What was sent and what came back").click();
    await expect(
      calls
        .nth(1)
        .getByRole("heading", { level: 4, name: "The person's material" })
        .locator("xpath=following-sibling::pre"),
    ).toContainText("Title: Payments API");
    await expect(
      calls
        .nth(1)
        .getByRole("heading", { level: 4, name: "What came back" })
        .locator("xpath=following-sibling::pre"),
    ).toContainText('"skill": "sql"');
    await app.expectAccessible("activity log");
  });

  test("S18: explains a gap, shows what is sent first, and keeps only the note the person accepts", async ({
    app,
    page,
  }) => {
    await page.route("https://api.anthropic.com/**", anthropic);
    await app.start();
    await app.put("pharoam.md", PHAROAM);
    await app.put("evidence/payments-api--0192f3a1.md", PAYMENTS_API);
    await app.choose();
    await app.nav("Settings").click();
    await page.getByRole("radio", { name: "Anthropic" }).check();
    await page.getByLabel("API key").fill("sk-ant-test");
    await page.getByLabel("Or type a model ID").fill("claude-test");
    await page.getByRole("button", { name: "Use this model" }).click();

    await app.nav("Pathways").click();
    await page.getByRole("link", { name: "Backend engineer" }).click();
    await page.getByRole("link", { name: "See my gap to this pathway" }).click();
    const card = page.getByRole("region", { name: "What this gap might mean" });
    await card.getByRole("button", { name: "Explain this gap" }).click();
    await expect(card.getByRole("region", { name: "What will be sent" })).toBeVisible();
    await app.expectAccessible("gap explanation, what will be sent");
    await card.getByRole("button", { name: "Send" }).click();
    await expect(card.getByText("Little of the pathway is in your profile yet.")).toBeVisible();
    await app.expectAccessible("gap explanation, answer");
    expect(await app.list("notes")).toHaveLength(0);

    await card.getByRole("button", { name: "Accept as a note" }).click();
    await expect(card.getByText(/^Saved as a note in /)).toBeVisible();
    const [note] = await app.list("notes");
    const text = (await app.read(`notes/${note ?? ""}`)) ?? "";
    expect(text).toContain("schema: note/1");
    expect(text).toContain("task: explain-gap@1");
    expect(text).toContain("- **Python**: It is core, and your payments work may already show it.");
    await app.expectAccessible("gap explanation, note");
  });
});
