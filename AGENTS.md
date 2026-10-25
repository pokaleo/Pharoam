# AGENTS.md

Instructions for AI coding agents working on Pharoam. Humans follow the same rules ([Engineering standards](docs/ENGINEERING.md)).

## What Pharoam is

Pharoam is an open-source, browser-first web app. It helps people build an evidence-based picture of their skills, compare career pathways and plan learning. **The user's data lives in storage they choose, never on Pharoam's infrastructure.** Licence: AGPL-3.0-only.

## Read before changing anything

| Need | Read |
|---|---|
| Principles and design rules R1–R16 | [docs/CHARTER.md](docs/CHARTER.md) §3 |
| What the product does | [docs/PRD.md](docs/PRD.md) || Architecture decisions | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/adr/](docs/adr/) |
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

## How the rules are enforced

These rules are checked by machines, not left to good intentions:

| Layer | When | What it does |
|---|---|---|
| **Claude Code hooks** (`.claude/settings.json`) | Before an edit or command | **Blocks** edits that break a content rule (telemetry, LangSmith, third-party scripts, raw HTML, JavaScript files) and denies `--no-verify`, `HUSKY=0`, force-pushes and agents unlocking enforcement edits. **Asks the user** before `git commit`, `git push`, `gh pr` changes, and before any edit or shell command that changes an enforcement file. |
| | After an edit | Lints the edited file and feeds errors back. |
| | Before finishing | `pnpm check` must pass when the working tree has changes. |
| **ESLint** (`tooling/eslint/`) | Edit, commit, CI | Architecture boundaries (rule 11), no storage clients in the relay (1), AI SDKs only in providers and `packages/core/src/ai` (5), no React in the core, no hard-coded UI text (12). Also TSDoc on every export and the TypeScript practices (ENGINEERING §2, §11). |
| **Git hooks** (husky) | Commit, push | pre-commit: lint-staged, content rules and the TDD check on staged files. commit-msg: commitlint. pre-push: `pnpm check`. |
| **CI** | Every PR | Everything above, plus `knip` (unused code) and the TypeDoc build (every export documented), as required checks on `main`. |

Rules that code scanning can't detect (2–4, 6, 8, 9) are enforced by tests, such as schema, codec and connector-suite tests, which these layers make sure run.

**Enforcement files change only with the user's approval.** They are the files that implement the checks, or could quietly weaken them (list in `tooling/guard/protected.ts`):

| Files | Why |
|---|---|
| `tooling/guard/`, `tooling/eslint/`, `eslint.config.ts`, `.claude/settings.json` | The checks themselves |
| `.husky/`, `.lintstagedrc.json`, `commitlint.config.ts`, `.github/workflows/` | When the checks run |
| `package.json` (root), `pnpm-workspace.yaml` | The `check` script; dependency build and release-age rules |
| `tsconfig*.json` (any), `vitest.config.ts`, `typedoc.json`, `knip.json` | Type strictness, which tests run, docs and unused-code checks |

- **Edits and shell commands both ask:** in-place `sed` and `perl`, `>`, `tee`, `cp`, `mv`, `rm`, git restores, applied patches and inline scripts that touch these files.
- **The user can pause the prompts** with `pnpm guard:unlock <minutes>` (up to 240; `0` locks again). Agents must never run it or write `.claude/guard-unlock`; the hook refuses them.
- **Change files the hook imports in one complete write.** A half-finished edit to `tooling/guard/` breaks the hook, which then refuses every protected change, including the fix.

## How to work

- **TDD, always:** write a failing test first, confirm it fails for the right reason, then implement the minimum and refactor. Bug fixes start with a reproducing test. Only spikes are exempt.
- **TypeScript only:** all code, including tool configs and scripts, is `.ts` or `.tsx`. JavaScript only as a named exception in `tooling/guard/content-rules.ts` (ADR-0002).
- **Document every export with TSDoc** (summary, `@param`, `@returns`, `@throws`, `@remarks` with the why and PRD/ADR IDs; no types in comments). Return expected failures as typed results; exceptions mean bugs. Follow the TypeScript practices in ENGINEERING §2 and §11 (ADR-0018).
- **Use the LSP** (go to definition, find references, rename, diagnostics) to navigate and change code. Changed files must have no diagnostics before committing.
- **Commits:** Conventional Commits, `type(scope): summary`, with a body explaining *why* and referencing PRD or ADR IDs (ENGINEERING §6).
- **PRs:** use the template; keep them small. Squash merge (ENGINEERING §7).
- **Never commit, push, open, merge or edit a PR unless the user explicitly says so at that moment.** Prepare changes locally, summarise them and wait. Approval for one commit or push doesn't carry over to the next. A Claude Code hook asks before `git commit`, `git push` and `gh pr`.
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
| `pnpm knip` | Unused files, exports and dependencies |
| `pnpm docs:api` | Build the API reference into `api-docs/` (fails on undocumented exports) |
| `pnpm check` | All of the above plus the hard-rule scan, as CI runs them |
| `pnpm guard:unlock <minutes>` | **User only.** Pause approval prompts for enforcement files |
