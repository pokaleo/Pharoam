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

## 3. Linting, formatting and boundaries

- **ESLint** (flat config) with:
  - `typescript-eslint` (type-checked rules);
  - `eslint-plugin-react-hooks`;
  - `eslint-plugin-jsx-a11y`;
  - **`eslint-plugin-boundaries`** to enforce the architecture (ADR-0003):
    - `packages/core` never imports browser, React, connector or provider code;
    - the UI never imports connectors or providers directly; it goes through the core service;
    - connectors and providers depend only on the core's interfaces.
- **Prettier** for formatting. ESLint does not check formatting (`eslint-config-prettier`).

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
4. build;
5. end-to-end tests with accessibility checks;
6. commit message check (commitlint);
7. dependency vulnerability scan and secret scanning;
8. a check that the published JSON Schemas match the Zod definitions.

**Renovate** keeps dependencies updated. Every action is pinned to an exact commit SHA ([Security](design/security.md) §7).

## 10. Documentation

- A change that alters a recorded decision **updates its ADR or design spec in the same PR**.
- A new significant decision gets a **new ADR** before or alongside the code.
- All interface text goes in translation files (ADR-0015); no hard-coded strings.
