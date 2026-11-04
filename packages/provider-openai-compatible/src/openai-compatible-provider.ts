/**
 * Any OpenAI-compatible API as a model provider: OpenAI, OpenRouter, or a local server such as Ollama or LM Studio.
 *
 * @packageDocumentation
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { err, ok, providerErrorFrom, type ModelProvider } from "@pharoam/core";
import { z } from "zod";

/** How to reach an OpenAI-compatible API. */
export interface OpenAiCompatibleOptions {
  /** The API's base address, ending in its version, such as `https://openrouter.ai/api/v1`. */
  readonly baseUrl: string;
  /** The person's API key, kept in memory for the session only; a local server needs none (ADR-0011). */
  readonly apiKey?: string;
  /** Sends HTTP requests; the browser's `fetch` unless a test supplies its own. */
  readonly fetch?: typeof fetch;
  /** How often a failed call is retried before it is reported, as OpenAI's SDK counts them. */
  readonly maxRetries?: number;
}

// OpenAI's SDK refuses an empty key, so a local server that needs none is sent this instead.
const NO_KEY = "no-key";

const ModelList = z.object({ data: z.array(z.object({ id: z.string(), name: z.string().optional() })) });

/**
 * Makes a provider that calls an OpenAI-compatible API directly from the browser.
 *
 * @remarks The address must be one the content security policy allows (security §4); the app checks that before
 * making a provider. The answer comes back as the arguments of a function call shaped like the task's output
 * schema, which most compatible servers support, including Ollama and LM Studio with models that can call tools.
 * Failures are returned as kinds the app can explain, never thrown.
 * @example
 * ```ts
 * const provider = createOpenAiCompatibleProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey });
 * const models = await provider.listModels();
 * ```
 * @param options - The address, the person's key if the API needs one, and for tests the `fetch` and retries.
 * @returns The provider, with the ID `openai-compatible`.
 */
export function createOpenAiCompatibleProvider(options: OpenAiCompatibleOptions): ModelProvider {
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const base = options.baseUrl.replace(/\/+$/, "");
  return {
    id: "openai-compatible",
    async listModels() {
      try {
        const headers: Record<string, string> =
          options.apiKey === undefined ? {} : { authorization: `Bearer ${options.apiKey}` };
        const response = await fetcher(`${base}/models`, { headers });
        if (!response.ok)
          return err(providerErrorFrom({ status: response.status, message: response.statusText }));
        const list = ModelList.safeParse(await response.json());
        if (!list.success) {
          return err({
            kind: "failed",
            message: "The list of models came back in a shape Pharoam doesn't know.",
          });
        }
        return ok(list.data.data.map((model) => ({ id: model.id, name: model.name ?? model.id })));
      } catch (error) {
        return err(providerErrorFrom(error));
      }
    },
    async complete(request, { model }) {
      try {
        const chat = new ChatOpenAI({
          apiKey: options.apiKey ?? NO_KEY,
          model,
          maxRetries: options.maxRetries ?? 2,
          configuration: { baseURL: base, dangerouslyAllowBrowser: true, fetch: fetcher },
        });
        const answer: unknown = await chat
          .withStructuredOutput(
            { ...request.output.schema },
            { name: request.output.name, method: "functionCalling" },
          )
          .invoke([new SystemMessage(request.system), new HumanMessage(request.prompt)]);
        return ok(answer);
      } catch (error) {
        return err(providerErrorFrom(error));
      }
    },
  };
}
