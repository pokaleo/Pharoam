import { describe, expect, it } from "vitest";
import { createOpenAiCompatibleProvider } from "./openai-compatible-provider.ts";

interface Sent {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: unknown;
}

// A stand-in for the network: answers in the OpenAI reply format, and keeps what was sent.
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

const toolReply = (args: unknown): Response =>
  json({
    id: "chatcmpl-1",
    object: "chat.completion",
    created: 1_790_000_000,
    model: "gpt-test",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "tag-text", arguments: JSON.stringify(args) },
            },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  });

const OPENROUTER = "https://openrouter.ai/api/v1";

describe("createOpenAiCompatibleProvider (AD11, spike S1)", () => {
  it("sends the core's request as it is to the chosen address, and returns the model's structured answer", async () => {
    const network = fakeFetch(() => toolReply({ tags: ["apis"] }));
    const provider = createOpenAiCompatibleProvider({
      baseUrl: OPENROUTER,
      apiKey: "sk-or-test",
      fetch: network.fetch,
      maxRetries: 0,
    });

    const answer = await provider.complete(request, { model: "some/model" });

    expect(answer).toEqual({ ok: true, value: { tags: ["apis"] } });
    expect(provider.id).toBe("openai-compatible");
    const [sent] = network.sent;
    expect(sent?.url).toBe(`${OPENROUTER}/chat/completions`);
    expect(sent?.headers.get("authorization")).toBe("Bearer sk-or-test");
    expect(sent?.body).toMatchObject({
      model: "some/model",
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.prompt },
      ],
      tools: [{ type: "function", function: { name: "tag-text", parameters: request.output.schema } }],
    });
  });

  it("works with a local server that needs no key", async () => {
    const network = fakeFetch(() => toolReply({ tags: [] }));
    const provider = createOpenAiCompatibleProvider({
      baseUrl: "http://localhost:11434/v1",
      fetch: network.fetch,
      maxRetries: 0,
    });

    expect(await provider.complete(request, { model: "llama" })).toEqual({ ok: true, value: { tags: [] } });
    expect(network.sent[0]?.url).toBe("http://localhost:11434/v1/chat/completions");
  });

  it.each([
    [401, { kind: "unauthorised" }],
    [429, { kind: "rate-limited" }],
  ])("reports an HTTP %i reply as a failure the app can explain", async (status, expected) => {
    const network = fakeFetch(() => json({ error: { message: "no" } }, status));
    const provider = createOpenAiCompatibleProvider({
      baseUrl: OPENROUTER,
      apiKey: "x",
      fetch: network.fetch,
      maxRetries: 0,
    });

    expect(await provider.complete(request, { model: "m" })).toEqual({ ok: false, error: expected });
  });

  it("says the provider can't be reached when the network fails", async () => {
    const network = fakeFetch(() => new TypeError("Failed to fetch"));
    const provider = createOpenAiCompatibleProvider({
      baseUrl: OPENROUTER,
      fetch: network.fetch,
      maxRetries: 0,
    });

    expect(await provider.complete(request, { model: "m" })).toEqual({
      ok: false,
      error: { kind: "unreachable" },
    });
  });

  it("lists the models at the address, with a readable name where the provider gives one", async () => {
    const network = fakeFetch(() =>
      json({
        object: "list",
        data: [
          { id: "a/one", name: "Model One" },
          { id: "two", object: "model" },
        ],
      }),
    );
    const provider = createOpenAiCompatibleProvider({
      baseUrl: OPENROUTER,
      apiKey: "k",
      fetch: network.fetch,
    });

    expect(await provider.listModels()).toEqual({
      ok: true,
      value: [
        { id: "a/one", name: "Model One" },
        { id: "two", name: "two" },
      ],
    });
    expect(network.sent[0]).toMatchObject({ url: `${OPENROUTER}/models`, method: "GET" });
    expect(network.sent[0]?.headers.get("authorization")).toBe("Bearer k");
  });

  it("asks a local server for its models without sending any key", async () => {
    const network = fakeFetch(() => json({ data: [] }));
    const provider = createOpenAiCompatibleProvider({
      baseUrl: "http://localhost:1234/v1",
      fetch: network.fetch,
    });

    expect(await provider.listModels()).toEqual({ ok: true, value: [] });
    expect(network.sent[0]?.headers.has("authorization")).toBe(false);
  });
});
