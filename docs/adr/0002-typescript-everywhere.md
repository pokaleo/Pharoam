# ADR-0002: TypeScript everywhere

- **Status:** Accepted
- **Date:** 2026-10-24
- **Covers:** AD2

## Context
The core logic must run in the browser and in the relay, and the schemas are shared between them.

## Decision
**TypeScript** for the core, the UI, the relay and the shared schemas.

## Alternatives rejected
- **A Rust core compiled to WebAssembly:** it gives more speed than personal-scale use needs, at much higher complexity for one developer.

## Consequences
One language and one type system end to end. Schemas and task definitions are written once.
