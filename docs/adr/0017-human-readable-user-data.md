# ADR-0017: Everything in the user's storage is human-readable

- **Status:** Accepted
- **Date:** 2026-10-24
- **Covers:** [Data model](../design/data-model.md) §0

## Context
The user owns their data and must be free to use it anywhere, for any purpose, without Pharoam ("anywhere, anytime, anyone").

## Decision
- **Everything stored in the user's storage is readable, self-explanatory and useful without Pharoam.** No opaque, system-specific blobs.
- Machine-specific working state (for example LangGraph checkpoints) lives **only in the disposable local cache**, and is rebuilt from readable records.
- Generated analyses (proficiency, gaps, the `pharoam.md` overview) are **stored** so they are readable outside Pharoam.
- `pharoam.md` is the central record about the person and **never holds a name, photo or contact details**.

## Alternatives rejected
- **Storing engine checkpoints or caches in the user's storage:** convenient for Pharoam, but meaningless and locked-in for the user.

## Consequences
Workflows must be resumable from a readable log (spike S2). Some data is stored twice: once readable in the user's storage, once as working state in the cache.
