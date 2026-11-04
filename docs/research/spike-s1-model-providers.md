# Spike S1: calling model providers from the browser

| | |
|---|---|
| **Date** | 3 November 2026 |
| **Feeds** | [Architecture](../ARCHITECTURE.md) (the CORS table, spike S1) · [Security](../design/security.md) §4 · [ADR-0011](../adr/0011-model-providers-and-keys.md) · [ADR-0012](../adr/0012-langchain-langgraph-pipelines.md) · [MVP](../MVP.md) §8, S13 |
| **Status** | Done. Two checks are left for the first call with a real key (phase 11), listed under "Still to confirm". |

**Question:** can the hosted app, served from `https://pokaleo.github.io`, call each v0.2 model provider straight from the browser, with no relay? And how much does the AI code add to the download?

**Answer:** yes for Anthropic, OpenAI and OpenRouter, in Chromium, WebKit and Firefox. A local server (Ollama, LM Studio) works only in Chromium and Firefox, after the person changes a server setting and grants the browser's local network permission; WebKit, and so Safari, blocks it outright. The AI code adds about 210–270 KB gzipped for one provider, loaded only once a model is set up.

## How it was tested

- **Preflights with curl:** the browser's CORS preflight (`OPTIONS`) sent to each endpoint with `Origin: https://pokaleo.github.io` and the headers each adapter sends. Then the actual request, with a dummy key, to see whether its reply carries a CORS header.
- **Real browsers:** Playwright's Chromium 156, WebKit 27.2 and Firefox 157 opened an `https` page and called each endpoint with `fetch` and a dummy key. A readable `401` means the browser let the call through; a `TypeError` means it blocked it.
- **Local servers:** neither Ollama nor LM Studio was installed, so a stand-in server on `127.0.0.1:11434` answered every request with fully permissive CORS headers, including Chrome's private network header. Any block is therefore the browser's, not the server's. The servers' own settings come from their documentation.
- **Download size:** the code an adapter needs (`ChatAnthropic` or `ChatOpenAI` with `withStructuredOutput` on a Zod schema) bundled with esbuild for the browser, minified, then gzipped. Packages: `@langchain/core` 1.3.4, `@langchain/anthropic` 1.6.0, `@langchain/openai` 1.8.0, `zod` 4.6.7.

The spike's code was throwaway and is not in the repository.

## Hosted providers

| Provider | Endpoint | Preflight from the app's origin | In the three browsers (dummy key) |
|---|---|---|---|
| **Anthropic** | `POST /v1/messages` | Allowed **only with** the `anthropic-dangerous-direct-browser-access` header; without it, `400` and no CORS header | Allowed (`401` readable) with the header; blocked without it |
| | `GET /v1/models` | Allowed with the header | Blocked: the `401` reply has no CORS header (see below) |
| **OpenAI** | `POST /v1/chat/completions` | Allowed; the origin is echoed back | Blocked: the `401` reply has no CORS header (see below) |
| | `GET /v1/models` | Allowed | Allowed (`401` readable) |
| **OpenRouter** | `POST /api/v1/chat/completions` | Allowed | Allowed (`401` readable) |
| | `GET /api/v1/models` | Allowed; needs no key | Allowed (`200`) |

The results were the same in all three browsers.

**Two blocks come from the dummy key, not from CORS.** For Anthropic's model list and OpenAI's chat endpoint, the preflight passes but the `401` reply to a dummy key has no `Access-Control-Allow-Origin` header, so the browser hides it. Both providers' SDKs support browser use (`dangerouslyAllowBrowser`), so successful replies are expected to carry the header, but only a real key can show it.

## Local servers

| | Chromium 156 | Firefox 157 | WebKit 27.2 (Safari) |
|---|---|---|---|
| `https` page calling `http://localhost` | Blocked until the person grants the **local network permission**; then allowed | Blocked: "Local Network Access permission required". The granted path couldn't be tested (Playwright can't grant it in Firefox) | **Blocked** as insecure content, with no permission to grant |

Each server also has to accept the app's origin:
- **Ollama** accepts cross-origin requests only from `127.0.0.1` and `0.0.0.0` by default. The person adds the app's address with `OLLAMA_ORIGINS` ([Ollama FAQ](https://docs.ollama.com/faq)).
- **LM Studio** needs its "Enable CORS" server setting turned on ([LM Studio docs](https://lmstudio.ai/docs/developer/core/server/settings)).

## Download size

Minified and gzipped (`gzip -9`), for the browser:

| Bundle | Minified | Gzipped | Gzipped, less Zod |
|---|---|---|---|
| Zod alone (the app already ships it) | 454 KB | 92 KB | — |
| Anthropic adapter | 1,259 KB | 305 KB | about 212 KB |
| OpenAI-compatible adapter | 1,547 KB | 361 KB | about 269 KB |
| Both | 1,793 KB | 425 KB | about 333 KB |

For scale, the whole app today is 291 KB of gzipped JavaScript.

By package, in the bundle with both adapters (minified): `zod` 503 KB, `openai` 433 KB, `@langchain/core` 248 KB, **`langsmith` 231 KB**, `@anthropic-ai/sdk` 179 KB, `@langchain/openai` 80 KB, `@langchain/anthropic` 48 KB, others under 10 KB each.

- **No single package passes the app's 500 KB chunk limit** (`apps/web/src/build/chunks.ts`), so the AI code fits if it is split into one chunk per package, as the app already does for other libraries.
- **`langsmith` comes in through `@langchain/core`**, although Pharoam never uses LangSmith (hard rule 7).

## Recommendations

1. **Content security policy:** `connect-src 'self' https://api.anthropic.com https://api.openai.com https://openrouter.ai http://localhost:* http://127.0.0.1:*`. Any port on `localhost`, since Ollama (11434) and LM Studio (1234) let the person change theirs.
2. **The Anthropic adapter always sends the opt-in header.** In LangChain this is `clientOptions: { dangerouslyAllowBrowser: true }` on `ChatAnthropic`.
3. **Local models in settings (S13.6):** explain the two steps, the server's origin setting and the browser's local network permission. In a browser that blocks local servers outright (Safari), say that local models don't work there.
4. **Load only the chosen provider's adapter,** in chunks of one package each: about 210–270 KB gzipped once a model is set up, nothing before. This is within what ADR-0012 accepted as "a larger download".
5. **Keep `langsmith` out of the bundle** if it can be done safely: point the import at a small stand-in that does nothing, saving 231 KB and leaving no tracing code to switch on by mistake. Phase 11 checks that `@langchain/core` still works with it; if it doesn't, the code ships unused, with tracing off and its endpoints blocked by the policy.

## Still to confirm

With a real key, in the first end-to-end call of phase 11:
- **Anthropic's model list** (`GET /v1/models`) returns a reply the browser can read. If not, the person types the model ID, which S13.2 already allows.
- **OpenAI's chat endpoint** (`POST /v1/chat/completions`) returns a reply the browser can read. If not, OpenAI is used through OpenRouter, and the policy drops `api.openai.com`.
