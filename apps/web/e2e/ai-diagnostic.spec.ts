import type { Route } from "@playwright/test";
import { expect, test } from "./fixtures.ts";
import { PAYMENTS_API, PHAROAM } from "./files.ts";

// The calls the canned model answered, so the journey can check nothing goes before the person agrees.
const answered: string[] = [];

// Answers for Anthropic's address in its own reply format: the AI-led diagnostic's three tasks, each as a tool call.
// The question count and the level to mark are read from the request, in the words the tasks send them in.
async function anthropic(route: Route): Promise<void> {
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
  };
  const request = route.request();
  if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  const raw = request.postData() ?? "{}";
  const body = JSON.parse(raw) as { tools?: { name?: string }[] };
  const task = body.tools?.[0]?.name ?? "";
  answered.push(task);
  // A new question each time, as the task refuses one the session already asked.
  const asked = (raw.match(/Question \d+, level/g) ?? []).length;
  const input =
    task === "write-diagnostic-item"
      ? {
          source: "written",
          format: "open",
          prompt: `Explain what a LEFT JOIN keeps (${String(asked + 1)}).`,
          rubric: "Keeps rows with no match.",
          why: "The evidence names a database but shows no joins.",
        }
      : task === "mark-diagnostic-answer"
        ? {
            level: Number(/Mark at level (\d)/.exec(raw)?.[1]),
            correct: true,
            reasons: "Says rows with no match are kept.",
          }
        : {
            showed: "Joins are solid.",
            comparison: "As you claimed.",
            reasons: [],
            next_step: "Try ranking rows with a window function.",
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

  test("S23: takes an AI-led diagnostic, showing each call first, and writes its explained result", async ({
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

    // The person's own rating of SQL at Expert, so two answers marked right there settle it.
    await app.nav("Skills").click();
    await page.getByRole("link", { name: "Record a level" }).click();
    await page.getByLabel("Skill").fill("SQL");
    await page.getByRole("radio", { name: /^Expert/ }).check();
    await page.getByRole("button", { name: "Record my level" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "SQL" })).toBeVisible();
    await page.getByRole("link", { name: "Check it with an AI-led diagnostic" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "SQL AI-led diagnostic" })).toBeVisible();
    await app.expectAccessible("AI-led diagnostic, how it works");
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByRole("region", { name: "What will be sent" })).toBeVisible();
    // Nothing goes to the model before the person agrees to the call shown (S23.1).
    expect(answered.filter((task) => task !== "check-model")).toEqual([]);

    const sent = page.getByRole("region", { name: "What will be sent" });
    for (let question = 1; question <= 2; question++) {
      await expect(sent.getByText(/Choosing a question at Expert/)).toBeVisible();
      if (question === 1) await app.expectAccessible("AI-led diagnostic, what will be sent");
      await page.getByRole("button", { name: "Send" }).click();
      await expect(page.getByText(`Question ${String(question)}`, { exact: true })).toBeVisible();
      if (question === 1) await app.expectAccessible("AI-led diagnostic, a written question");
      await page.getByLabel("Your answer").fill("The rows on the left with no match on the right.");
      await page.getByRole("button", { name: "Answer" }).click();
      await expect(sent.getByText("Marking your answer")).toBeVisible();
      await page.getByRole("button", { name: "Send" }).click();
    }
    await expect(sent.getByText("Explaining the result")).toBeVisible();
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Your SQL result" })).toBeVisible();
    await expect(page.getByText("Explained by anthropic/claude-test")).toBeVisible();
    await expect(page.getByText(/Written and marked by AI, which can be wrong/)).toBeVisible();
    await app.expectAccessible("AI-led diagnostic, the result");
    const evidence = await app.list("evidence");
    expect(evidence).toHaveLength(2);
    const record = (await Promise.all(evidence.map((name) => app.read(`evidence/${name}`)))).find((text) =>
      text?.includes("type: ai-led"),
    );
    expect(record).toContain("result: 4");
    expect(record).toContain("task: explain-diagnostic@1");
    const skills = await Promise.all((await app.list("skills")).map((name) => app.read(`skills/${name}`)));
    const sql = skills.find((text) => text?.includes("skill: sql")) ?? "";
    const id = /^id: (\S+)$/m.exec(record ?? "")?.[1] ?? "";
    // The tested level, linked to the record that holds every question and answer (S23.4).
    expect(sql).toMatch(
      new RegExp(`level: 4\\n(?:.*\\n)*?.*provenance: ai-correlated\\n(?:.*\\n)*?.*assessment: ${id}`),
    );

    await app.nav("Activity log").click();
    await expect(page.getByRole("heading", { name: "Choosing a diagnostic question" })).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "Marking a diagnostic answer" })).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "Explaining a diagnostic's result" })).toHaveCount(1);
  });
});
