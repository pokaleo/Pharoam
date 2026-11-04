/**
 * Loads the model provider the person chose: the only place the web app touches a provider package.
 *
 * @packageDocumentation
 */
import type { ModelProvider } from "@pharoam/core";
import type { ProviderChoice } from "../ai/providers.ts";

/**
 * Loads a chosen provider's code and makes the provider.
 *
 * @remarks Each provider package is imported only when it is chosen, so its code arrives in chunks of its own and
 * nothing AI-related loads before a model is set up (MVP S13.1, spike S1). Only the composition root may import
 * provider packages (AGENTS.md rule 11); the rest of the app gets this function through its services.
 * @param choice - The provider, its checked address and the person's key.
 * @returns The provider, ready to list models and run tasks.
 */
export async function loadProvider(choice: ProviderChoice): Promise<ModelProvider> {
  const key = choice.apiKey === undefined ? {} : { apiKey: choice.apiKey };
  if (choice.kind === "anthropic") {
    const { createAnthropicProvider } = await import("@pharoam/provider-anthropic");
    return createAnthropicProvider({ apiKey: choice.apiKey ?? "" });
  }
  const { createOpenAiCompatibleProvider } = await import("@pharoam/provider-openai-compatible");
  return createOpenAiCompatibleProvider({ baseUrl: choice.address, ...key });
}
