/**
 * Anthropic as a model provider, called straight from the browser.
 *
 * @packageDocumentation
 */
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { err, ok, providerErrorFrom, type ModelProvider } from "@pharoam/core";
import { z } from "zod";

/** How to reach Anthropic. */
export interface AnthropicOptions {
  /** The person's API key, kept in memory for the session only (ADR-0011, MVP S13.4). */
  readonly apiKey: string;
  /** Sends HTTP requests; the browser's `fetch` unless a test supplies its own. */
  readonly fetch?: typeof fetch;
  /** How often a failed call is retried before it is reported, as Anthropic's SDK counts them. */
  readonly maxRetries?: number;
}

const API = "https://api.anthropic.com";

// The longest answer a task may get; normalising a whole CV can need several thousand tokens.
const MAX_TOKENS = 8192;

const ModelList = z.object({
  data: z.array(z.object({ id: z.string(), display_name: z.string().optional() })),
});

/**
 * Makes a provider that calls Anthropic's API directly from the browser.
 *
 * @remarks Every call sends Anthropic's browser opt-in header, without which the browser blocks it (spike S1). The
 * answer comes back as the input of a tool shaped like the task's output schema, so the core can check it
 * (`runTask`). Failures are returned as kinds the app can explain, never thrown.
 * @example
 * ```ts
 * const provider = createAnthropicProvider({ apiKey });
 * const answer = await runTask(provider, task, input, { model: "claude-sonnet-5-5", now: () => new Date() });
 * ```
 * @param options - The person's key, and for tests the `fetch` to use and how often to retry.
 * @returns The provider, with the ID `anthropic`.
 */
export function createAnthropicProvider(options: AnthropicOptions): ModelProvider {
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const headers = {
    "x-api-key": options.apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
  return {
    id: "anthropic",
    async listModels() {
      try {
        const response = await fetcher(`${API}/v1/models?limit=1000`, { headers });
        if (!response.ok)
          return err(providerErrorFrom({ status: response.status, message: response.statusText }));
        const list = ModelList.safeParse(await response.json());
        if (!list.success)
          return err({
            kind: "failed",
            message: "The list of models came back in a shape Pharoam doesn't know.",
          });
        return ok(list.data.data.map((model) => ({ id: model.id, name: model.display_name ?? model.id })));
      } catch (error) {
        return err(providerErrorFrom(error));
      }
    },
    async complete(request, { model }) {
      try {
        const chat = new ChatAnthropic({
          apiKey: options.apiKey,
          model,
          maxTokens: MAX_TOKENS,
          maxRetries: options.maxRetries ?? 2,
          clientOptions: { dangerouslyAllowBrowser: true, fetch: fetcher },
        });
        const answer: unknown = await chat
          .withStructuredOutput({ ...request.output.schema }, { name: request.output.name })
          .invoke([new SystemMessage(request.system), new HumanMessage(request.prompt)]);
        return ok(answer);
      } catch (error) {
        return err(providerErrorFrom(error));
      }
    },
  };
}
