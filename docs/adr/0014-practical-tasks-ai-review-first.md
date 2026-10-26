# ADR-0014: Practical tasks marked by AI review first

- **Status:** Accepted
- **Date:** 2026-10-24
- **Covers:** AD13

## Context
Practical tasks (for example code) in AI-led diagnostics (ADR-0019) need marking. Automatic checking requires sandboxed code execution in the browser or on a server.

## Decision
Start small: practical tasks are **marked by an AI review task** against the item's rubric, labelled and disclaimed as AI marking. **Sandboxed execution for automatic checks is a future feature.**

## Alternatives rejected (for now)
- **In-browser runtimes** (Web Workers, Pyodide): feasible, but not needed to start.
- **WebContainers:** production use needs a commercial licence.
- **A code-execution service behind the relay:** heavy, and a security burden.

## Consequences
Minimal mode can't check practical tasks until execution exists.
