/**
 * The model providers the app offers, and the only addresses it will call them at.
 *
 * @packageDocumentation
 */
import { err, ok, type ModelProvider, type Result } from "@pharoam/core";

/** Which provider the person chose. */
export type ProviderKind = "anthropic" | "openai" | "openrouter" | "local";

/** One provider the model settings offer. */
export interface ProviderOption {
  /** The address calls go to: fixed for a hosted provider, the default for a local server. */
  readonly address: string;
  /** Whether the provider needs the person's API key; a local server doesn't. */
  readonly needsKey: boolean;
  /** The provider's own data policy, which governs what the person sends it (MVP S13.7); none for a local server. */
  readonly dataPolicy?: string;
}

/**
 * The providers on offer, in the order the settings list them.
 *
 * @remarks These are the only addresses the content security policy lets the app reach (security §4, ADR-0011):
 * any other provider needs a self-hosted build. Ollama's default port is the local server's default; LM Studio and
 * changed ports are typed in.
 */
export const PROVIDERS: Readonly<Record<ProviderKind, ProviderOption>> = {
  anthropic: {
    address: "https://api.anthropic.com",
    needsKey: true,
    dataPolicy: "https://www.anthropic.com/legal/privacy",
  },
  openai: {
    address: "https://api.openai.com/v1",
    needsKey: true,
    dataPolicy: "https://openai.com/policies/privacy-policy/",
  },
  openrouter: {
    address: "https://openrouter.ai/api/v1",
    needsKey: true,
    dataPolicy: "https://openrouter.ai/privacy",
  },
  local: { address: "http://localhost:11434/v1", needsKey: false },
};

/**
 * Works out the address to call a provider at.
 *
 * @remarks A hosted provider is always called at its fixed address. A local server's address is typed in, so it
 * be `http` on `localhost` or `127.0.0.1`, which is all the content security policy allows (MVP S13.5).
 * @param kind - The chosen provider.
 * @param typed - The address the person typed, used only for a local server.
 * @returns The address without a trailing slash, or `not-local` when a typed address isn't on this machine.
 */
export function providerAddress(
  kind: ProviderKind,
  typed: string,
): Result<string, { readonly kind: "not-local" }> {
  if (kind !== "local") return ok(PROVIDERS[kind].address);
  const address = URL.parse(typed.trim());
  const local =
    address !== null &&
    address.protocol === "http:" &&
    (address.hostname === "localhost" || address.hostname === "127.0.0.1");
  return local ? ok(typed.trim().replace(/\/+$/, "")) : err({ kind: "not-local" });
}

/** The provider the person chose, ready to load. */
export interface ProviderChoice {
  /** Which provider. */
  readonly kind: ProviderKind;
  /** Where to call it, checked with {@link providerAddress}. */
  readonly address: string;
  /** The person's key, kept in memory only; none for a local server (ADR-0011). */
  readonly apiKey?: string;
}

/**
 * Loads a chosen provider's code and makes the provider.
 *
 * @remarks The composition root supplies it, since only it may import provider packages (AGENTS.md rule 11). Each
 * provider's code is loaded only when this is called, so the app loads no AI code until a model is set up (MVP
 * S13.1, spike S1).
 */
export type LoadProvider = (choice: ProviderChoice) => Promise<ModelProvider>;

/** The model the person set up for this session: the provider, and the provider's ID for the model (MVP S13). */
export interface ModelSetup {
  /** The provider, its address and the person's key. */
  readonly choice: ProviderChoice;
  /** The provider's own ID for the model, picked from its list or typed (MVP S13.2). */
  readonly model: string;
  /** The model's readable name from the provider's list, when it was picked from one. */
  readonly name?: string;
}
