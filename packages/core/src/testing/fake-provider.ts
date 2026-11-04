/**
 * A model provider for tests, which answers as the test decides and never touches the network.
 *
 * @packageDocumentation
 */
import type { ModelInfo, ModelProvider, ModelRequest, ProviderError } from "../ai/provider.ts";
import { ok, type Result } from "../result.ts";

/** A fake provider, with every request it was sent. */
export interface FakeProvider extends ModelProvider {
  /** Each request and model, in the order they came, so a test can check exactly what was sent. */
  readonly requests: readonly { readonly request: ModelRequest; readonly model: string }[];
}

/**
 * Makes a provider that answers each request with what `answer` returns.
 *
 * @remarks Core and app tests run tasks against it, so no test calls a real model (MVP §8, exit criterion 5).
 * @param answer - Decides the answer, or the failure, for each request.
 * @param models - The models it lists; none by default.
 * @returns The provider, recording its requests. Its ID is `fake`.
 */
export function fakeProvider(
  answer: (request: ModelRequest) => Result<unknown, ProviderError>,
  models: readonly ModelInfo[] = [],
): FakeProvider {
  const requests: { readonly request: ModelRequest; readonly model: string }[] = [];
  return {
    id: "fake",
    requests,
    listModels: () => Promise.resolve(ok(models)),
    complete: (request, { model }) => {
      requests.push({ request, model });
      return Promise.resolve(answer(request));
    },
  };
}
