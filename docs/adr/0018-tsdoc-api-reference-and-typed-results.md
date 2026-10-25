# ADR-0018: TSDoc on every export, a generated API reference, and typed results for expected failures

- **Status:** Accepted
- **Date:** 2026-10-24
- **Covers:** AD23; [Engineering standards](../ENGINEERING.md) §2, §11

## Context
Pharoam has one developer today, with coding agents doing much of the work, and open-source contributors later. The code needs to be understandable without asking its author: what each part promises, why it exists, and how it can fail. That explanation should be published as technical documentation without writing it twice.

Failures are also part of the contract. Storage conflicts, files that fail validation and AI output that doesn't match its schema are normal events in Pharoam (AD10, ADR-0004, data model "Needs attention"). If they are thrown as exceptions, nothing in a function's type says they can happen.

## Decision
- **Every exported item has a TSDoc comment:** functions, classes, interfaces and their members, type aliases and constants.
  - A one-line summary, `@param` and `@returns`.
  - `@throws` when a function can throw, and `@remarks` for the *why*, with PRD and ADR IDs.
  - `@example` on the contracts between parts: the core service, connector, provider and AI task interfaces.
  - No types in comments; TypeScript holds them.
- **Private helpers are commented only when they aren't obvious.** A `/** */` comment is always a doc comment and must be complete, so short notes use `//`.
- **TypeDoc generates the API reference.** It is built in CI and not committed, so it can't drift from the code, and it will be published on GitHub Pages next to the app.
- **Missing docs fail the build:** `eslint-plugin-jsdoc` while editing and committing, and TypeDoc's `notDocumented` validation (warnings as errors) in CI. TypeDoc also catches what lint can't, such as members of inline types and unexported types used in the API.
- **Expected failures are returned as typed results**, not thrown: a small hand-written `Result` type in `packages/core`, for example `{ ok: false, error: { kind: "conflict", … } }`, with a union of error kinds per operation. **Exceptions mean bugs.** No result library.
- **Lint-checked TypeScript practices** (`tooling/eslint/typescript.ts`): explicit return types on exports, named exports only, no type assertions on object literals, exhaustive `switch` over unions, and a naming convention. `knip` reports unused files, exports and dependencies.

## Alternatives rejected
- **Comments on every function, private ones included:** produces filler that restates the code.
- **Markdown reference committed to `docs/api/`:** readable on GitHub, but drifts from the code and makes every change a noisy diff.
- **API Extractor:** API reports and declaration rollups are built for published libraries; Pharoam is an app.
- **`eslint-plugin-tsdoc`:** it pins an older `typescript-eslint` that doesn't support TypeScript 6. `eslint-plugin-jsdoc`'s TSDoc preset and TypeDoc's own validation cover the same ground.
- **A result library (neverthrow, Effect):** more API to learn for what a few lines of types provide.
- **Exceptions for expected failures:** invisible in types, so callers forget to handle them.

## Consequences
Every exported item costs a comment, and the build fails until it is written. Agents get a hard signal instead of a guideline. Code that calls the core must handle each error kind explicitly. Until `packages/` exist, the reference covers the tooling code, which proves the pipeline end to end.
