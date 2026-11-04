import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Route } from "@playwright/test";
import { expect, test } from "./fixtures.ts";
import { PHAROAM } from "./files.ts";

// Answers for Anthropic's address, in its own reply format, so the journey runs the real adapter, the content
// security policy and the browser's CORS checks without a real key (MVP §8, exit criterion 5).
async function anthropic(route: Route): Promise<void> {
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
  };
  const request = route.request();
  if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  if (request.url().includes("/v1/models")) {
    return route.fulfill({
      headers: cors,
      json: {
        data: [
          {
            type: "model",
            id: "claude-test",
            display_name: "Claude Test",
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        has_more: false,
      },
    });
  }
  return route.fulfill({
    headers: cors,
    json: {
      id: "msg_1",
      type: "message",
      role: "assistant",
      model: "claude-test",
      content: [{ type: "tool_use", id: "toolu_1", name: "check-model", input: { ready: true } }],
      stop_reason: "tool_use",
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  });
}

test.describe("with Anthropic set up", () => {
  test.use({ provider: "https://api.anthropic.com" });

  test("S13: sets up and tests a model, loading no AI code until asked, under the content security policy", async ({
    app,
    page,
  }) => {
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(request.url());
    });
    const sent: string[] = [];
    await page.route("https://api.anthropic.com/**", (route) => {
      sent.push(`${route.request().method()} ${route.request().url()}`);
      return anthropic(route);
    });

    await app.start();
    await app.put("pharoam.md", PHAROAM);
    await app.choose();
    await app.nav("Settings").click();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await app.expectAccessible("settings");
    await page.getByRole("radio", { name: "Anthropic" }).check();
    await page.getByLabel("API key").fill("sk-ant-test");
    expect(scripts.filter((url) => url.includes("/ai-"))).toEqual([]);

    await page.getByRole("button", { name: "Show models" }).click();
    await page.getByRole("combobox", { name: "Model" }).selectOption("claude-test");
    await page.getByRole("button", { name: "Use this model" }).click();
    await expect(page.getByText("Using Claude Test (claude-test) from Anthropic.")).toBeVisible();
    await page.getByRole("button", { name: "Test the model" }).click();

    await expect(page.getByText("It works: the model answered in the shape Pharoam needs.")).toBeVisible();
    expect(scripts.some((url) => url.includes("/ai-anthropic"))).toBe(true);
    expect(scripts.some((url) => url.includes("/ai-openai"))).toBe(false);
    expect(sent).toContain("POST https://api.anthropic.com/v1/messages");
    await app.expectAccessible("settings, model in use");
  });
});

test("ships no LangSmith code in the built app (hard rule 7, spike S1)", async () => {
  const assets = path.join(import.meta.dirname, "../../../dist/web/assets");
  const files = (await readdir(assets)).filter((file) => file.endsWith(".js"));
  expect(files.some((file) => file.startsWith("ai-langchain"))).toBe(true);

  for (const file of files) {
    // The LangSmith client's endpoint: it is in the langsmith package, which the stand-in replaces.
    expect(await readFile(path.join(assets, file), "utf8"), file).not.toContain("api.smith.langchain.com");
  }
});
