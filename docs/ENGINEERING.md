# Engineering standards

| | |
|---|---|
| **Version** | 0.1 |
| **Date** | 24 October 2026 |
| **Applies to** | Everyone writing code for Pharoam, human or AI agent. Agents start from [`AGENTS.md`](../AGENTS.md). |

## 1. Test-driven development, throughout

**All production code is written test-first**: core, connectors, providers, relay and UI.

1. **Red:** write a failing test that states the behaviour. Run it, and check it fails *for the right reason*.
2. **Green:** write the minimal code to pass it.
3. **Refactor:** tidy up with the tests green.

- **Bug fixes start with a test that reproduces the bug.**
- UI components are tested through behaviour (Testing Library), not implementation details.
- **Exception: spikes** (S1–S3) are throwaway experiments. They are not test-driven and are never merged as production code.

## 2. TypeScript

- `strict`, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- **No `any`.** Untrusted data (file contents, AI output, network responses) is `unknown` until validated with Zod.
- ES modules only.
- **TypeScript only** (ADR-0002): all code, including tool configs and scripts, is `.ts` or `.tsx`. Node 26 runs TypeScript directly, and ESLint, Prettier and commitlint load `.ts` configs. JavaScript is allowed only as a named exception, with its reason, in `tooling/guard/content-rules.ts`; there are none today. The guard refuses other `.js`, `.mjs`, `.cjs` and `.jsx` files.

Practices (ADR-0018). Those marked *lint* are checked by ESLint (`tooling/eslint/typescript.ts` and typescript-eslint's strict rules); the rest are checked in review.

| Practice | Why | Check |
|---|---|---|
| **Explicit return types on exported functions** | The API stays stable and the docs say what comes back. | lint |
| **Named exports only** (default exports only in tool configs and type shims) | Names stay the same across imports and in the API reference. | lint |
| **No `as` on object literals; casts only right after validation** | A cast hides missing fields; Zod proves them. | lint |
| **No non-null assertions (`!`)** | Handle the missing case instead. | lint |
| **Unions of string literals instead of enums**, handled with exhaustive `switch` | Adding a case breaks every place that must handle it. (`enum` is already banned by `erasableSyntaxOnly`.) | lint |
| **Naming:** `camelCase` values and functions, `PascalCase` types, components and Zod schemas, `UPPER_CASE` fixed values; property names follow their outside source | One style; external shapes (front matter, hook payloads) stay as they are. | lint |
| **Expected failures are returned as typed results**; exceptions mean bugs | Storage conflicts, invalid files and off-schema AI output show up in the type, so callers must handle them. A small hand-written `Result` type in `packages/core`, no library. | review |
| **`readonly` inputs and immutable data** by default | Functions don't change what they're given; easier to test and reason about. | review |
| **Branded ID types** (`SkillId`, `EvidenceId`, …) once `packages/core` exists | Different IDs can't be mixed up. | review |
| **Pure logic, with I/O passed in** (as in `tooling/guard`) | Logic is tested without files, network or clocks. | review |
| **No unused files, exports or dependencies** | Dead code misleads readers and agents. | `knip` |

## 3. Linting, formatting and boundaries

- **ESLint** (flat config) with:
  - `typescript-eslint` (type-checked rules);
  - `eslint-plugin-react-hooks`;
  - `eslint-plugin-jsx-a11y`;
  - **`eslint-plugin-boundaries`** to enforce the architecture (ADR-0003):
    - `packages/core` never imports browser, React, connector or provider code;
    - the UI never imports connectors or providers directly; it goes through the core service;
    - connectors and providers depend only on the core's interfaces.
- **Prettier** for formatting code, JSON and YAML. ESLint does not check formatting (`eslint-config-prettier`). **Markdown docs are excluded**: Prettier pads tables to their widest cell, which hurts editing and turns every table change into a full-table diff.
- **Boundary rules are themselves tested** (`tooling/eslint/boundaries.test.ts`): a change to the rules must keep those tests green.
- **Version notes:**
  - **TypeScript 6.0** is pinned until `typescript-eslint` supports TypeScript 7.
  - **ESLint 10** is used with a documented peer-range exception for `eslint-plugin-jsx-a11y`: it was verified to work, but its declared range is out of date.
  - Dependency build scripts are **denied unless reviewed** (`allowBuilds` in `pnpm-workspace.yaml`).
  - **`eslint-plugin-tsdoc` is not used:** it pins a `typescript-eslint` without TypeScript 6 support. `eslint-plugin-jsdoc`'s TSDoc preset and TypeDoc's validation cover it.

## 4. Testing strategy

| Layer | Tool | Rule |
|---|---|---|
| Core | Vitest | Test-first; target **90%+ coverage** for `packages/core` |
| File format | Vitest | **Round-trip tests**: read → write keeps unknown fields, comments and field order |
| Connectors | Vitest | Every connector passes the **shared connector test suite** (conflicts, change listing, attachments) |
| AI tasks | Vitest | **Recorded responses**; CI never calls a live model. An optional evaluation set runs before a task's version is bumped. |
| UI | Vitest + Testing Library | Behaviour-level component tests |
| End to end | Playwright | Key journeys, with **axe** accessibility checks (WCAG 2.2 AA) |

## 5. Editor and LSP

- Use the **TypeScript language server (LSP)** for navigating and changing code: go to definition, find references, rename symbol and diagnostics. Don't rely on text search for these.
- **Before committing, there must be no LSP diagnostics** (type errors) in the changed files.
- The repo provides `.editorconfig` and recommended editor extensions (ESLint, Prettier).

## 6. Commits

**Conventional Commits**, checked in CI by commitlint:

```
<type>(<scope>): <summary in the imperative, ≤ 72 chars>

<body: what changed and WHY. Reference PRD/ADR IDs, e.g. "Implements PRD B4; see ADR-0006.">

<footer: Refs #12 · BREAKING CHANGE: …>
```

- **Types:** `feat`, `fix`, `test`, `refactor`, `docs`, `build`, `ci`, `chore`, `perf`, `security`.
- **Scopes:** the package or area, for example `core`, `web`, `relay`, `connector-folder`, `provider-anthropic`, `content`, `data`, `docs`.
- One logical change per commit. Tests and the code they drive go in the same commit.

## 7. Pull requests

- **Every change goes through a PR**, even when working solo. CI is the gate.
- PRs follow the template (`.github/pull_request_template.md`): summary, why, changes, tests (TDD evidence), and the hard-rules checklist.
- Small and focused; **squash-merged**. The squash commit message follows §6.

## 8. Git workflow and releases

- **Trunk-based:** short-lived branches off `main`; `main` is protected (PR, passing CI, linear history).
- Branch names: `<type>/<short-description>`, for example `feat/evidence-forms`.
- **Semantic versioning**, with changelogs generated from commit history.

## 9. CI (GitHub Actions)

Every PR runs:
1. lint (ESLint), format check (Prettier), boundary rules;
2. type check;
3. unit tests and coverage;
4. the hard-rule content checks, unused-code check (`knip`) and API reference build (every export documented);
5. build;
6. end-to-end tests with accessibility checks;
7. commit message check (commitlint);
8. dependency vulnerability scan and secret scanning;
9. a check that the published JSON Schemas match the Zod definitions.

**Renovate** keeps dependencies updated. Every action is pinned to an exact commit SHA ([Security](design/security.md) §7).

## 10. Enforcement of the hard rules

The hard rules in `AGENTS.md` are enforced at three layers that share the same checks:
- **Claude Code hooks** (`.claude/settings.json`) check while an agent is editing.
- **Git hooks** (husky + lint-staged) check every commit and push, from any tool or person.
- **CI** is the required final gate.

The shared checks are:
- **ESLint rules** in `tooling/eslint/`;
- **content rules** in `tooling/guard/`, such as the telemetry deny-list and the LangSmith, third-party-script and raw-HTML checks;
- the **TDD check**: a changed source file must come with a changed or existing test;
- **command rules**: verification can't be skipped, and committing and publishing need the user's approval.

The enforcement code is itself built test-first (`tooling/**/*.test.ts`). Some rules can't be detected by scanning code; those are enforced by tests.

**Enforcement files** (listed in `tooling/guard/protected.ts` and AGENTS.md) change only with the user's approval. These are the checks themselves, when they run, and the settings that could quietly weaken them: the root `package.json`, any `tsconfig*.json`, `vitest.config.ts`, `typedoc.json` and `knip.json`. Agents are asked before an edit to them, and before a shell command that writes them. The user can pause the prompts with `pnpm guard:unlock <minutes>`, which agents are refused. Commits, pushes and PRs still ask, and hard-rule violations are still refused.

Known limits:
- The shell-command check is pattern matching, so a determined workaround can get past it. The git hooks and CI still catch the result, and every enforcement change shows in the PR diff.
- The hook fails closed: if a change breaks it, it refuses every protected change, including the fix. The user then applies the fix by hand.
- Hooks can be disabled locally. CI cannot.

## 11. Code documentation

**Every exported item has a TSDoc comment** (ADR-0018): functions, classes, interfaces and their members, type aliases and constants. TypeDoc turns them into the API reference.

```ts
/**
 * Lists staged changes that break a hard rule or have no test.
 *
 * @remarks Runs in the git pre-commit hook; see ENGINEERING §10.
 * @param staged - Repo-relative paths mapped to their staged content.
 * @param fileExists - Tells whether a repo-relative path exists in the working tree.
 * @returns One message per problem; empty when the commit may go ahead.
 */
export function checkStaged(...)
```

- **Summary first:** one sentence saying what it does, not how. Then a blank line before the tags.
- **Tags:**
  - `@param name - description` for each parameter (TSDoc's hyphen; no dotted names);
  - `@returns` when something is returned;
  - `@throws` when it can throw;
  - `@remarks` for the *why*, constraints, and PRD or ADR IDs;
  - `@typeParam` for generics;
  - `@example` on the contracts between parts (core service, connector, provider and AI task interfaces);
  - `@deprecated` with what to use instead.
- **No types in comments**; TypeScript holds them.
- **Say something the signature doesn't.** "The name." for a parameter `name` is rejected by lint.
- **Each module starts with a comment** ending in `@packageDocumentation`, saying what the file is for.
- **Private helpers:** comment only when they aren't obvious. A `/** */` comment is checked for completeness, so short notes on helpers use `//`.

**Checks:**
- `eslint-plugin-jsdoc` runs while editing, at commit and in CI.
- `pnpm docs:api` builds the reference with TypeDoc. It fails on any undocumented export or broken link, including what lint can't see, such as members of inline types.
- The output (`api-docs/`) is not committed. Until `packages/` exist, the reference covers `tooling/`.

## 12. Documentation

- A change that alters a recorded decision **updates its ADR or design spec in the same PR**.
- A new significant decision gets a **new ADR** before or alongside the code.
- All interface text goes in translation files (ADR-0015); no hard-coded strings.
