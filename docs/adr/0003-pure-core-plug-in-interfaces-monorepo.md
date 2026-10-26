# ADR-0003: Pure core with plug-in interfaces, in a monorepo

- **Status:** Accepted
- **Date:** 2026-10-24
- **Covers:** AD3, AD15

## Context
The same logic must serve the web app, the relay and the tests, and must work across many storage backends and model providers.

## Decision
- `packages/core` holds the profile model, schemas, validation, shown-level and gap calculation, AI task and workflow definitions, and the core service. It has **no browser or UI dependencies**.
- Storage connectors, model providers and content sources plug in through small interfaces ([interfaces](../design/interfaces.md)).
- A **pnpm monorepo**:
  - `packages/core`, `packages/connector-*`, `packages/provider-*`;
  - `apps/web`, `apps/relay`;
  - `content/`, `data/` (with its own licences), `site/`, `docs/`.
- Vitest and Playwright for tests; GitHub Actions for CI; GitHub Pages for hosting.

## Alternatives rejected
- **A single app folder:** faster to start, but connectors, providers and the relay would become tangled with the UI.

## Consequences
More structure up front. Every new connector or provider plugs into the same interface. Details of the tooling are revisited during implementation planning.
