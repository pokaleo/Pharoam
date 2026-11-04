import { describe, expect, it } from "vitest";
import { createAnthropicProvider } from "./anthropic-provider.ts";

interface Sent {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: unknown;
}

// A stand-in for the network: answers with Anthropic's own reply format, and keeps what was sent.
function fakeFetch(reply: (sent: Sent) => Response | Error): { fetch: typeof fetch; sent: Sent[] } {
  const sent: Sent[] = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const text = await request.text();
    const one: Sent = {
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: text === "" ? undefined : (JSON.parse(text) as unknown),
    };
    sent.push(one);
    const answer = reply(one);
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { fetch: fetcher, sent };
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const request = {
  system: "Suggest up to three tags.\n\nRules.",
  prompt: '<data kind="pasted-text">\nI built an API.\n</data>',
  output: {
    name: "tag-text",
    schema: {
      type: "object",
      properties: { tags: { type: "array", items: { type: "string" } } },
      required: ["tags"],
    },
  },
};

const toolReply = (input: unknown): Response =>
  json({
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-test",
    content: [{ type: "tool_use", id: "toolu_1", name: "tag-text", input }],
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  });

describe("createAnthropicProvider (AD11, spike S1)", () => {
  it("sends the core's request as it is, with the browser opt-in header, and returns the model's structured answer", async () => {
    const network = fakeFetch(() => toolReply({ tags: ["apis"] }));
    const provider = createAnthropicProvider({ apiKey: "sk-ant-test", fetch: network.fetch, maxRetries: 0 });

    const answer = await provider.complete(request, { model: "claude-test" });

    expect(answer).toEqual({ ok: true, value: { tags: ["apis"] } });
    expect(provider.id).toBe("anthropic");
    const [sent] = network.sent;
    expect(sent?.url).toBe("https://api.anthropic.com/v1/messages");
    expect(sent?.headers.get("x-api-key")).toBe("sk-ant-test");
    expect(sent?.headers.get("anthropic-dangerous-direct-browser-access")).toBe("true");
    expect(sent?.body).toMatchObject({
      model: "claude-test",
      system: request.system,
      messages: [{ role: "user", content: request.prompt }],
      tools: [{ name: "tag-text", input_schema: request.output.schema }],
    });
  });

  it.each([
    [401, { kind: "unauthorised" }],
    [429, { kind: "rate-limited" }],
  ])("reports an HTTP %i reply as a failure the app can explain", async (status, expected) => {
    const network = fakeFetch(() => json({ type: "error", error: { type: "x", message: "no" } }, status));
    const provider = createAnthropicProvider({ apiKey: "sk-ant-test", fetch: network.fetch, maxRetries: 0 });

    expect(await provider.complete(request, { model: "claude-test" })).toEqual({
      ok: false,
      error: expected,
    });
  });

  it("says the provider can't be reached when the network fails", async () => {
    const network = fakeFetch(() => new TypeError("Failed to fetch"));
    const provider = createAnthropicProvider({ apiKey: "sk-ant-test", fetch: network.fetch, maxRetries: 0 });

    expect(await provider.complete(request, { model: "claude-test" })).toEqual({
      ok: false,
      error: { kind: "unreachable" },
    });
  });

  it("lists the models the key can use, by ID and readable name", async () => {
    const network = fakeFetch(() =>
      json({
        data: [
          { type: "model", id: "claude-a", display_name: "Claude A", created_at: "2026-01-01T00:00:00Z" },
          { type: "model", id: "claude-b", display_name: "Claude B", created_at: "2026-01-01T00:00:00Z" },
        ],
        has_more: false,
        first_id: "claude-a",
        last_id: "claude-b",
      }),
    );
    const provider = createAnthropicProvider({ apiKey: "sk-ant-test", fetch: network.fetch, maxRetries: 0 });

    expect(await provider.listModels()).toEqual({
      ok: true,
      value: [
        { id: "claude-a", name: "Claude A" },
        { id: "claude-b", name: "Claude B" },
      ],
    });
    const [sent] = network.sent;
    expect(sent?.method).toBe("GET");
    expect(sent?.url).toMatch(/^https:\/\/api\.anthropic\.com\/v1\/models\b/);
    expect(sent?.headers.get("anthropic-dangerous-direct-browser-access")).toBe("true");
  });

  it("reports a refused key when listing models", async () => {
    const network = fakeFetch(() => json({ type: "error" }, 401));
    const provider = createAnthropicProvider({ apiKey: "bad", fetch: network.fetch, maxRetries: 0 });

    expect(await provider.listModels()).toEqual({ ok: false, error: { kind: "unauthorised" } });
  });
});
