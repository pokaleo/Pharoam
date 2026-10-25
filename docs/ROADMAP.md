# Pharoam implementation plan

| | |
|---|---|
| **Version** | 0.1 (draft) |
| **Date** | 25 October 2026 |
| **Source** | [MVP and release plan](MVP.md) (what each release contains) · [Architecture](ARCHITECTURE.md) (how it's built) |
| **Status** | The order of work. MVP.md says *what*; this says *in what order* and *what depends on what*. No dates or estimates: a phase is done when its checks pass. Work is tracked in the GitHub project; this file is the plan it follows. |

## 1. How the plan works

- **Releases** become GitHub milestones (`v0.1` … `v0.4`). **Phases** split a release into ordered steps; each phase is a label (`phase:1` …).
- **Issues:** one per story (S1–S12) and one per foundation or content task. A story issue lists its acceptance criteria from MVP §5 as a checklist and links back to them.
- **Only v0.1 is in GitHub.** Later releases stay outlined here (§4) until v0.1 is nearly done, so the backlog doesn't fill with work that will change.
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
| **2. Core** | The `Result` type, branded IDs and UUIDv7; the record codec (Markdown with a YAML top block, keeping unknown fields, comments and order); Zod schemas for profile and content records; integrity fingerprints; JSON Schema generation with a CI check; the core service skeleton | 1 | Round-trip tests pass for every record type; the JSON Schema check runs in CI |
| **3. Folder connector** | The shared connector test suite (conflicts, change listing); the folder connector over the File System Access API, tested against an in-memory folder | 2 | The folder connector passes the shared suite |
| **4. Content** | The skill-vocabulary subset (about 300 skills from the MIND fork, stable slugs, the shared level scale); skill-specific level descriptions for the pathways' skills; the 4 pathways; the bundle compiler with its manifest | 2 (schemas) | Every content file validates; the bundle builds; the founder has reviewed each pathway |
| **5. Stories in the core** | S1–S12: each story's behaviour in the core service, tested against its acceptance criteria | 3, 4 | Every criterion's data and behaviour is covered by a passing test |
| **6. Design system** | **The founder's work:** the design system the interface is built on | — (can start any time) | The founder signs it off for use |
| **7. Web app** | The Vite + React app on the design system: shell, routing, translation, accessibility checks, the screens for S1–S12, end-to-end tests, deployment to GitHub Pages | 5, 6 | Every criterion passes end to end; axe passes on every screen; the app is live |
| **8. Founder trial** | Two weeks of real use against the exit criteria (MVP §4) | 7 | Every exit criterion is met |

Phase 4 runs alongside phase 3. The pathways are content, drafted with AI and reviewed by the founder in their PRs (PRD I3).

## 4. Later releases (outline)

Moved into GitHub when v0.1 is nearly done. Details and what each resumes from are in MVP §7.

| Release | First steps | Then |
|---|---|---|
| **v0.2** AI assistance | **Spike S2** (LangGraph in the browser, resuming from the readable log) and **spike S3** (WebAuthn PRF for the app lock); model provider settings | Normalising pasted text, proposed observations, the AI overall level, attachments, the transparency view |
| **v0.3** Assessments | The `assessment-item` schema and the first items | Multiple-choice, open-answer and practical tasks; `demonstrated` observations; sessions |
| **v0.4** Learning | Aspirations | Learning plans, pathway comparison, full pathway detail |
| **Later** | **Spike S1** (CORS) before any connector that calls an outside service | More connectors and browsers, the offline app, career readiness, the relay |

## 5. GitHub setup

| Item | Setup |
|---|---|
| **Milestones** | `v0.1` now; later releases when they're moved in |
| **Labels** | Type: `feat`, `build`, `docs`, `security`, `spike`, `content`. Area: `area:core`, `area:connector-folder`, `area:web`, `area:content`. Phase: `phase:1` … `phase:8`. |
| **Project board** | "Pharoam" with the columns Backlog → Ready → In progress → In review → Done |
| **Issue text** | What and why, the PRD/ADR/story IDs, acceptance criteria as a checklist, and what it depends on |
