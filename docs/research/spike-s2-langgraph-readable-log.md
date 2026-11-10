# Spike S2: LangGraph in the browser, resuming from the readable log

| | |
|---|---|
| **Date** | 10 November 2026 |
| **Feeds** | [ADR-0012](../adr/0012-langchain-langgraph-pipelines.md) · [ADR-0017](../adr/0017-human-readable-storage.md) · [Data model](../design/data-model.md) §10 · [Roadmap](../ROADMAP.md) §5 (v0.3) |
| **Status** | Done. Findings to review before v0.3's design; ADR-0012's "subject to spike S2" can be settled from them. |

**Question:** can a LangGraph.js workflow pause for the person's input in the browser, be written to their storage as a readable session log, and resume later from that log alone, with the engine's own checkpoint kept only in memory (ADR-0017)?

**Answer:** yes, in Chromium, WebKit and Firefox, provided the graph pauses with `NodeInterrupt` and takes the person's input through `updateState`. LangGraph's newer `interrupt()` cannot be used in a browser: it depends on Node's `AsyncLocalStorage`, which the web entry replaces with a mock, and a stand-in for it silently loses pauses. LangGraph adds about 160 KB gzipped on top of the `@langchain/core` the app already loads.

## How it was tested

A question-bank diagnostic as a graph (ADR-0019, PRD E2): a bank of two items per level, a `mark` node applying a fixed rule (right moves the probe up a level, wrong moves it down; the result is the highest level answered right), three items per session, no model involved, so the spike isolates LangGraph's mechanics. Packages: `@langchain/langgraph` 1.5.2 (web entry), `@langchain/core` 1.3.4, `yaml` 2.9.1, bundled with esbuild 0.27 and run with Playwright 1.64.1's Chromium, WebKit and Firefox, and in Node 26.

- **Session one** starts, answers two items, and stops with the third posed. Its state is written as a readable log: a `session/1`-shaped top block (skill, probe level, each item asked with its answer and marking, the item posed next) and a Markdown summary.
- **Session two** is a fresh graph on a fresh `MemorySaver`, as after a reload. It gets only the log's text, rebuilds the state with `updateState`, runs on, and must pose the same item; the answer then finishes the diagnostic.
- **A straight run** gives the same three answers without a pause. The resumed session's final state must equal it.

Two ways of pausing were tried:
- **A:** `interrupt()` inside the node, resumed with `Command({ resume })`, the current API.
- **B:** `pose` writes which item waits; `ask` throws `NodeInterrupt` until the answer is in the state, which the app puts there with `updateState(config, { answer }, "pose")`, then `invoke(null)`.

The spike's code is throwaway and is not in the repository.

## Results

| | Node, LangGraph's own async context | Chromium, WebKit, Firefox | Browser with a stand-in async context |
|---|---|---|---|
| **A, `interrupt()`** | Works: pauses, rebuilds from the log, poses the same item, final state equal | Fails at once: "Called interrupt() outside the context of a graph" | Pauses once, then **loses the second pause**: the graph runs on without an answer, silently |
| **B, `NodeInterrupt` + `updateState`** | Works | **Works in all three**: pauses, rebuilds from the log, poses the same item, final state equal to the unbroken run | Not needed |

- **Why A fails in browsers.** `interrupt()` finds the graph's config through `AsyncLocalStorageProviderSingleton`, which LangGraph's Node entry initialises with `node:async_hooks` and the web entry leaves as a mock whose store is always empty. Browsers have no equivalent. A simple stand-in (one store at a time, held while a callback's promise is pending) satisfies the first pause but breaks on resume, because nested runs interleave and `interrupt()` reads the wrong scratchpad: it returns instead of pausing, and the diagnostic continues with no answer given. That is a silent wrong result, so no stand-in should be used.
- **Why B suits Pharoam anyway.** The answer enters the graph the same way the rebuilt state does, through `updateState`, so the readable log really is the only state: resuming after a reload and resuming after a click are one path. It is the older mechanism (LangGraph documents `NodeInterrupt` as superseded by `interrupt()`), so its continued support is a dependency risk to watch at each upgrade.
- **Rebuilding from the log.** `updateState(config, values, asNode)` attributes the values to the node before the pause (`pose`), and the graph works out the next node itself (`getState().next` was `["ask"]`). Nothing engine-specific had to be stored: no checkpoint, no task IDs.
- **A trap:** `Command({ resume: 0 })` is read as an empty command and rejected ("Received empty Command input"). An answer index of 0 is ordinary, so B's `updateState` path avoids this too.
- **Download.** The graph as the app would import it, with `@langchain/core` and `langsmith` left out as already loaded: 686 KB minified, **160 KB gzipped**. The whole web entry is 166 KB gzipped on the same basis; `@langchain/core` alone is 155 KB. For comparison, spike S1 measured 210–270 KB gzipped for one provider including the core. So diagnostics would add roughly 160 KB to AI-assisted mode's download, loaded only when a diagnostic runs.

## What this means for v0.3

1. **Pause with `NodeInterrupt`, resume through `updateState`.** Never `interrupt()` in the browser, and never an async-context stand-in.
2. **The session record is the checkpoint's source.** Each pause writes the record (data model §10); resuming rebuilds the state from it with `updateState` as the node before the pause, then `invoke(null)`. The `MemorySaver` is disposable and never written to storage (ADR-0017).
3. **Check `NodeInterrupt` at every LangGraph upgrade.** If it is removed, the fallback is a plain state machine without LangGraph for question-bank diagnostics, which this spike's graph shows is small; ADR-0012's value is then in AI-led diagnostics, where approvals and model calls interleave.
4. **Budget about 160 KB gzipped** for LangGraph, loaded with the first diagnostic.
