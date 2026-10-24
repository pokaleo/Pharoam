# AGENTS.md

Instructions for AI coding agents working on Pharoam. Humans follow the same rules ([Engineering standards](docs/ENGINEERING.md)).

## What Pharoam is

Pharoam is an open-source, browser-first web app. It helps people build an evidence-based picture of their skills, compare career pathways and plan learning. **The user's data lives in storage they choose, never on Pharoam's infrastructure.** Licence: AGPL-3.0-only.

## Read before changing anything

| Need | Read |
|---|---|
| Principles and design rules R1–R16 | [docs/CHARTER.md](docs/CHARTER.md) §3 |
| What the product does | [docs/PRD.md](docs/PRD.md) |
| Architecture decisions | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/adr/](docs/adr/) |
| Data shapes and file format | [docs/design/data-model.md](docs/design/data-model.md) |
| Contracts between parts | [docs/design/interfaces.md](docs/design/interfaces.md) |
| Security rules | [docs/design/security.md](docs/design/security.md) |
| Coding, testing, commits, PRs | [docs/ENGINEERING.md](docs/ENGINEERING.md) |

## Hard rules: never break these

1. **No profile data on any server.** The relay processes in memory and records nothing. Never add server-side storage of user data.
2. **Everything written to the user's storage is human-readable** Markdown with a YAML top block. No opaque blobs, engine checkpoints or internal state (data model §0).
3. **Never silently overwrite** a record changed outside Pharoam. Never delete or rewrite invalid records; list them under "Needs attention".
4. **Pharoam never edits** observation or review entries or assessment evidence. It only appends.
5. **Every AI call goes through a registered task** (ADR-0004). No inline prompts in UI or connector code. Validate AI output against the task's schema.
6. **All AI output is labelled and disclaimed**, records its task and model, and is written only after the user approves (except the overall level, ADR-0016).
7. **No telemetry, no analytics, no third-party scripts.** LangSmith tracing stays off and blocked.
8. **Never store names, photos or contact details** in `pharoam.md`.
9. **No confidence scores and no hidden scoring formulas** (Charter R1, R4–R6).
10. **Render Markdown with raw HTML disabled and sanitised**; block remote images by default.
11. **Respect the architecture boundaries:** `packages/core` has no browser, React, connector or provider imports; the UI talks only to the core service.
12. **No hard-coded interface text.** All of it goes in translation files.

## How to work

- **TDD, always:** write a failing test first, confirm it fails for the right reason, then implement the minimum and refactor. Bug fixes start with a reproducing test. Only spikes are exempt.
- **Use the LSP** (go to definition, find references, rename, diagnostics) to navigate and change code. Changed files must have no diagnostics before committing.
- **Commits:** Conventional Commits, `type(scope): summary`, with a body explaining *why* and referencing PRD or ADR IDs (ENGINEERING §6).
- **PRs:** use the template; keep them small. Squash merge (ENGINEERING §7).
- If a change conflicts with a decision, **stop and raise it**. Don't work around an ADR silently. Update the ADR or spec in the same PR when a decision changes.

## Commands

Node 26 (`.nvmrc`), pnpm 12 (exact version pinned in `package.json`; pnpm switches to it automatically).

| Command | Does |
|---|---|
| `pnpm install` | Install dependencies (build scripts are denied unless listed in `pnpm-workspace.yaml`) |
| `pnpm test` / `pnpm test:watch` | Vitest |
| `pnpm lint` | ESLint, including the architecture boundary rules |
| `pnpm format` / `pnpm format:check` | Prettier (code, JSON, YAML; not Markdown) |
| `pnpm typecheck` | TypeScript |
| `pnpm check` | All of the above, as CI runs them |
