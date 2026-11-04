/**
 * The contract between the core and a model provider: what a provider is asked, and what it can answer.
 *
 * @remarks Providers live in `packages/provider-*` and do the network and SDK work (AD11a). The core builds every
 * request and checks every answer, so no provider can skip the marking of the person's data or the output schema
 * (ADR-0004, security §3, interfaces §3).
 * @packageDocumentation
 */
import type { Result } from "../result.ts";

/** What a model is asked for one task: fixed instructions, then the person's material as marked data. */
export interface ModelRequest {
  /** The task's instructions and Pharoam's rules for marked data. Never contains the person's text. */
  readonly system: string;
  /** The person's material, each part inside `<data>` tags. */
  readonly prompt: string;
  /** The shape the answer must take, for providers that can ask the model for structured output. */
  readonly output: {
    /** The task's name, which some providers send as the name of the answer's shape. */
    readonly name: string;
    /** The task's output schema, as JSON Schema. */
    readonly schema: Readonly<Record<string, unknown>>;
  };
}

/** One model a provider offers, as the model settings list it (MVP S13.2). */
export interface ModelInfo {
  /** The provider's own ID for the model, as calls name it. */
  readonly id: string;
  /** A readable name, or the ID again where the provider gives none. */
  readonly name: string;
}

/** Why a provider couldn't answer, in kinds the app can explain in plain words (MVP S13.3, S15.6). */
export type ProviderError =
  | { readonly kind: "unauthorised" }
  | { readonly kind: "rate-limited" }
  | { readonly kind: "unreachable" }
  | { readonly kind: "refused"; readonly reason: string }
  | { readonly kind: "failed"; readonly message: string };

/**
 * A model provider, such as Anthropic or an OpenAI-compatible API.
 *
 * @remarks An implementation sends what it is given, unchanged, and returns the model's answer as parsed but
 * unchecked JSON; the core checks it against the task's schema (`runTask`). Expected failures are returned, not
 * thrown (ADR-0018).
 * @example
 * ```ts
 * const answer = await provider.complete(prepareCall(task, input).request, { model: "claude-sonnet-5-5" });
 * if (!answer.ok) return explain(answer.error);
 * ```
 */
export interface ModelProvider {
  /** A short name for the provider, such as `anthropic`, recorded with the model in every `ai` block. */
  readonly id: string;
  /**
   * Lists the models the person can pick from.
   *
   * @returns The models, or why they couldn't be listed.
   */
  listModels(): Promise<Result<readonly ModelInfo[], ProviderError>>;
  /**
   * Sends one request to one model.
   *
   * @param request - What to send, exactly as the core prepared it.
   * @param options - Which model to use, by the provider's own ID.
   * @returns The model's answer as parsed JSON, not yet checked, or why there is none.
   */
  complete(
    request: ModelRequest,
    options: { readonly model: string },
  ): Promise<Result<unknown, ProviderError>>;
}

/**
 * Names a model as the `ai` block records it: the provider, then the model.
 *
 * @param provider - The provider the model was called through.
 * @param model - The provider's own ID for the model.
 * @returns A name such as `anthropic/claude-sonnet-5-5` (data model §5).
 */
export function modelName(provider: Pick<ModelProvider, "id">, model: string): string {
  return `${provider.id}/${model}`;
}

/**
 * Turns whatever a provider's SDK or `fetch` threw into a kind of failure the app can explain.
 *
 * @remarks Provider SDKs throw errors that carry the HTTP status. A network failure is a `TypeError` from
 * `fetch`, or an SDK connection error, which has no status and keeps that `TypeError` as its cause. Providers
 * return the result, so the app never sees a raw error (ADR-0018).
 * @param error - What was thrown, or an object with the reply's `status` and `message`.
 * @returns The failure: unauthorised (401, 403), rate-limited (429), unreachable, or failed with the message.
 */
export function providerErrorFrom(error: unknown): ProviderError {
  const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
  const message =
    typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
      ? error.message
      : String(error);
  if (status === 401 || status === 403) return { kind: "unauthorised" };
  if (status === 429) return { kind: "rate-limited" };
  if (typeof status === "number") return { kind: "failed", message: `${String(status)}: ${message}` };
  const network =
    error instanceof TypeError ||
    (error instanceof Error && (error.name === "APIConnectionError" || error.cause instanceof TypeError));
  if (network) return { kind: "unreachable" };
  return { kind: "failed", message };
}
