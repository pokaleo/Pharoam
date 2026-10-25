# ADR-0002: TypeScript everywhere

- **Status:** Accepted (extended 2026-10-25 to tooling and configs)
- **Date:** 2026-10-24
- **Covers:** AD2

## Context
The core logic must run in the browser and in the relay, and the schemas are shared between them. Tool configs and scripts were first written in JavaScript out of habit, which left the repo with two languages and two styles of type checking: real types and JSDoc annotations.

## Decision
- **TypeScript** for the core, the UI, the relay and the shared schemas.
- **TypeScript for all other code too:** tool configs (`eslint.config.ts`, `prettier.config.ts`, `commitlint.config.ts`, `vitest.config.ts`) and scripts in `tooling/`. Node 26 runs TypeScript directly, and these tools load `.ts` configs (ESLint through `jiti`).
- **JavaScript only as a named exception**, when a tool truly can't load TypeScript. Each one is listed with its reason in `tooling/guard/content-rules.ts`. There are none today. The guard refuses any other `.js`, `.mjs`, `.cjs` or `.jsx` file.

## Alternatives rejected
- **A Rust core compiled to WebAssembly:** it gives more speed than personal-scale use needs, at much higher complexity for one developer.
- **JavaScript for configs and scripts:** traditional, but it needs `allowJs`, `checkJs` and JSDoc type annotations, which follow different documentation rules from the rest of the code.

## Consequences
One language and one type system end to end. Schemas and task definitions are written once. Configs are type-checked like everything else. ESLint needs `jiti` to load its TypeScript config.
