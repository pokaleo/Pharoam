# Pharoam implementation plan

| | |
|---|---|
| **Version** | 0.2 (draft) |
| **Date** | 3 November 2026 |
| **Source** | [MVP and release plan](MVP.md) (what each release contains) · [Architecture](ARCHITECTURE.md) (how it's built) |
| **Status** | The order of work. MVP.md says *what*; this says *in what order* and *what depends on what*. No dates or estimates: a phase is done when its checks pass. Work is tracked in the GitHub project; this file is the plan it follows. |

## Where things stand

*3 November 2026.* **v0.1 is closed, and v0.2 is next** (§4). The founder trial (phase 8) was skipped so that AI assistance could start sooner; MVP §4 records which exit criteria that leaves unchecked.

*29 October 2026.* Phases 1–7 are done: the core, the folder connector, the content, every story's behaviour, the design system and the web app, with end-to-end tests in Chromium, WebKit and Firefox. **The app is live at [pokaleo.github.io/Pharoam](https://pokaleo.github.io/Pharoam/)**, deployed from `main`. Chromium browsers keep the profile in a folder; Safari and Firefox keep it in the browser's own storage, with a downloadable copy ([ADR-0020](adr/0020-browser-storage-where-no-folder.md)). Every screen now follows the design system's components and samples: the sidebar with places for later areas, levels as named steps, source labels, gap groups, tables that stack on a phone, and the selected skill beside the skills overview. Next is phase 8, the founder trial.

## 1. How the plan works

- **Releases** become GitHub milestones (`v0.1` … `v0.4`). **Phases** split a release into ordered steps; each phase is a label (`phase:1` …).
- **Issues:** one per story (S1–S12) and one per foundation or content task. A story issue lists its acceptance criteria from MVP §5 as a checklist and links back to them.
- **Only the current release is in GitHub.** Later releases stay outlined here (§5) until the one before is nearly done, so the backlog doesn't fill with work that will change. v0.2 moves into GitHub once its stories (MVP §8) are signed off.
- **Every issue is built test-first** (ENGINEERING §1) and lands through a PR that passes CI.

## 2. The frontend waits for the design system

**No interface work starts until the founder's design system is in place** (AD14: the design system is decided separately, with dedicated design tools). So v0.1 is built in two halves:

1. **Headless first (phases 1–5):** the core, the folder connector and the content, with **every story's behaviour implemented in the core service and tested there**. Acceptance criteria are checked against the core service, not a screen.
2. **Interface second (phases 6–7):** once the design system exists, the web app is built on it. Each story then gets its screen, and its criteria are checked again end to end, with accessibility checks.

Criteria that are only about a screen are tested in phase 7: S1.2's form fields, S1.5 (no network requests from the running app), S4.5's rendering, S9.3's filtering and S11.3's display. Their data side is still tested in phase 5; for example, the `pharoam` schema has no field for a name or contact details.

## 3. v0.1 phases

```
1 Foundations ──▶ 2 Core ──▶ 3 Folder connector ──▶ 5 Stories in the core ──┐
                     │                                   ▲                  ├──▶ 7 Web app ──▶ 8 Founder trial
                     └──────▶ 4 Content ─────────────────┘                  │
                                                     6 Design system (founder) ┘
```

| Phase | Contents | Depends on | Done when |
|---|---|---|---|
| **1. Foundations** | Workspace packages `packages/core` and `packages/connector-folder`, each with its own tsconfig, tests and boundary rules; `content/` and `data/` with their licences; a 90% coverage threshold for the core | — | `pnpm check` passes with the new packages; boundary tests cover them |
| **2. Core** | The `Result` type, branded IDs and UUIDv7; the record codec (Markdown with a YAML top block, keeping unknown fields, comments and order); Zod schemas for profile and content records; integrity fingerprints (canonical form, data model §4); JSON Schema generation with a CI check; the core service skeleton | 1 | Round-trip tests pass for every record type and the real-world file corpus; fingerprint tests pin the canonical form; the JSON Schema check runs in CI |
| **3. Folder connector** | The shared connector test suite (conflicts, including edits between read and write; change listing); the folder connector over the File System Access API, tested against an in-memory folder | 2 | The folder connector passes the shared suite |
| **4. Content** | The skill-vocabulary subset (about 300 skills from the MIND fork, stable slugs, the shared level scale); skill-specific level descriptions for the pathways' skills; the 4 pathways; the bundle compiler with its manifest | 2 (schemas) | Every content file validates; the bundle builds; the founder has reviewed each pathway |
| **5. Stories in the core** | S1–S12: each story's behaviour in the core service, tested against its acceptance criteria | 3, 4 | Every criterion's data and behaviour is covered by a passing test |
| **6. Design system** | **The founder's work:** the design system the interface is built on | — (can start any time) | The founder signs it off for use |
| **7. Web app** | The Vite + React app on the design system: shell, routing, translation, accessibility checks, the screens for S1–S12, end-to-end tests, deployment to GitHub Pages | 5, 6 | Every criterion passes end to end; axe passes on every screen; the app is live |
| **8. Founder trial** | Two weeks of real use against the exit criteria (MVP §4) | 7 | **Skipped** (3 November 2026): criteria 5–6 are met, 1–4 unchecked in real use |

Phase 4 runs alongside phase 3. The pathways are content, drafted with AI and reviewed by the founder in their PRs (PRD I3).

## 4. v0.2 phases

What v0.2 contains, its exit criteria and its stories (S13–S18) are in MVP §8. Every story is built test-first: core tests use a **fake provider**, and the end-to-end journeys answer the provider's real address with canned replies, so no test calls a real model. **Every PR delivers a whole working slice**, with no feature flags: a story's screens appear only in the PR that completes it, since every merge to `main` goes live.

```
9 Stories signed off ──▶ 10 Spike S1 ──▶ 11 AI foundations ──┬──▶ 13 Normalise pasted text ──▶ 14 Evidence scan ──▶ 15 Transparency view
                                                             │            ▲                                              │
                         12 Attachments ─────────────────────┼────────────┘                                              ▼
                                                             └──────────────────────────────────────────────▶ 16 Gap explanation
```

| Phase | Contents | Depends on | Done when |
|---|---|---|---|
| **9. Stories** | MVP §8 signed off; v0.2 milestone and issues in GitHub | — | The founder signs off S13–S18 |
| **10. Spike S1** | Call Anthropic, OpenAI, OpenRouter, Ollama and LM Studio from the GitHub Pages address, confirming the CORS table (Architecture); measure the AI code's download size | 9 | **Done** (3 November 2026, [findings](research/spike-s1-model-providers.md)): the policy's provider list is settled in security §4; two replies are left to confirm with a real key in phase 11 |
| **11. AI foundations** (S13, part of S17) | `defineTask` and the task registry in the core; the provider interface, with Anthropic and OpenAI-compatible adapters in `packages/provider-*` and a fake provider for tests; prompts with the person's text as marked data; output checked against the task's schema; call records; the AI code split into one chunk per package, without `langsmith` if a stand-in works (spike S1); the first call with a real key, confirming the two replies spike S1 couldn't; the hand-run check's example inputs and what a good answer must contain (MVP §8, exit criterion 2). Web: model settings, the session-only key, AI code loaded only with a model set up, the content security policy's provider list | 10 | One task runs end to end against the fake provider; with no model set up, no AI code loads |
| **12. Attachments** (S14) | Attachments in the folder and browser-storage connectors and the evidence screens | 9 | Both connectors pass the shared suite with attachments |
| **13. Normalise pasted text** (S15) | Task `normalise-evidence@1`; pasting into the evidence flow, reusing the S4.2 preview; the original kept as an attachment | 11, 12 | Pasted text becomes confirmed, labelled evidence |
| **14. Evidence scan** (S16) | Tasks `suggest-skill-links@1` (per record) and `judge-skill-level@1` (per skill, from its linked evidence only, on request); one review session per scan with accept, skip, discard and adjust; the Review screen and the sidebar count; the shown-level change in the core (the newer claim wins, PRD C4) | 13 | An accepted suggestion is an `ai-judged` observation citing its evidence; a skipped one never counts |
| **15. Transparency view** (S17) | The view over the session's call records | 14 | Every call so far can be inspected in full |
| **16. Gap explanation** (S18) | Task `explain-gap@1` in the gap view's card; accepted explanations as `note/1` records in `notes/` (data model §10) | 11 | The card's placeholder is gone |

Phase 12 can run alongside 10 and 11. Phase 16 needs only the foundations, so it can move earlier, or slip to the next release if the rest is ready first. Before release, the hand-run check is run against a real model and recorded in the release PR.

## 5. Later releases (outline)

Moved into GitHub when the release before is nearly done. Details and what each resumes from are in MVP §7.

| Release | First steps | Then |
|---|---|---|
| **v0.3** Diagnostics | **Spike S2** (LangGraph in the browser, resuming from the readable log), since diagnostics are the first workflows that pause and resume; the `assessment-item` schema and the first question-bank items | Adaptive question-bank diagnostics (`demonstrated`); AI-led diagnostics with open answers and practical tasks (`ai-correlated`); sessions |
| **v0.4** Learning | Aspirations | Learning plans, pathway comparison, full pathway detail |
| **Later** | **Spike S3** (WebAuthn PRF) before the app lock and remembered keys | More connectors and browsers, the offline app, career readiness, the relay |

## 6. GitHub setup

| Item | Setup |
|---|---|
| **Milestones** | One per release in GitHub (`v0.1`, then `v0.2`); later releases when they're moved in |
| **Labels** | Type: `feat`, `build`, `docs`, `security`, `spike`, `content`. Area: `area:core`, `area:connector-folder`, `area:web`, `area:content`. Phase: `phase:1` … `phase:16`. Area for v0.2: `area:provider`. |
| **Project board** | "Pharoam" with the columns Backlog → Ready → In progress → In review → Done |
| **Issue text** | What and why, the PRD/ADR/story IDs, acceptance criteria as a checklist, and what it depends on |
