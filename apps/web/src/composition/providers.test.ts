import { checkModel, runTask } from "@pharoam/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadProvider } from "./providers.ts";

const now = (): Date => new Date("2026-11-04T10:00:00.000Z");

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadProvider (MVP S13, spike S1)", () => {
  it("runs a registered task through Anthropic's adapter in the app, with the langsmith stand-in in place", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      urls.push(new Request(input).url);
      return Promise.resolve(
        json({
          id: "msg_1",
          type: "message",
          role: "assistant",
          model: "claude-test",
          content: [{ type: "tool_use", id: "toolu_1", name: "check-model", input: { ready: true } }],
          stop_reason: "tool_use",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      );
    });

    const provider = await loadProvider({
      kind: "anthropic",
      address: "https://api.anthropic.com",
      apiKey: "k",
    });
    const answer = await runTask(provider, checkModel, {}, { model: "claude-test", now });

    expect(provider.id).toBe("anthropic");
    expect(answer.ok).toBe(true);
    expect(urls).toEqual(["https://api.anthropic.com/v1/messages"]);
  });

  it("calls an OpenAI-compatible provider at the chosen address", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      urls.push(new Request(input).url);
      return Promise.resolve(json({ data: [{ id: "llama" }] }));
    });

    const provider = await loadProvider({ kind: "local", address: "http://localhost:1234/v1" });

    expect(provider.id).toBe("openai-compatible");
    expect(await provider.listModels()).toEqual({ ok: true, value: [{ id: "llama", name: "llama" }] });
    expect(urls).toEqual(["http://localhost:1234/v1/models"]);
  });
});
