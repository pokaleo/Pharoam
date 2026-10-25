# Pharoam Architecture

| | |
|---|---|
| **Version** | 0.1 (in discussion) |
| **Date** | 24 October 2026 |
| **Source** | [Charter](CHARTER.md) · [PRD](PRD.md) |
| **Status** | Architecture decisions are recorded here once they are decided. Implementation planning starts only after the open decisions are settled. |

## How decisions and specifications are recorded

- **This file** is the overview and the index of decisions.
- **`docs/adr/`** holds one short ADR per significant decision: its context, the decision, rejected alternatives and consequences.
- **`docs/design/`** holds specifications: the [data model](design/data-model.md), [interfaces](design/interfaces.md) and the [security model](design/security.md).

| ADR | Title | Covers |
|---|---|---|
| [0001](adr/0001-browser-first-web-app.md) | Browser-first web app | AD1 |
| [0002](adr/0002-typescript-everywhere.md) | TypeScript everywhere | AD2 |
| [0003](adr/0003-pure-core-plug-in-interfaces-monorepo.md) | Pure core with plug-in interfaces, in a monorepo | AD3, AD15 |
| [0004](adr/0004-registered-ai-tasks.md) | Every AI feature is a registered task | AD4 |
| [0005](adr/0005-content-packs.md) | Content as versioned packs | AD5, AD16 |
| [0006](adr/0006-record-format-markdown-yaml.md) | One data shape; Markdown with a YAML top block | AD6, AD19 |
| [0007](adr/0007-zod-schemas-versioning.md) | Zod schemas, published JSON Schema, versioned records | AD7 |
| [0008](adr/0008-react-vite-spa.md) | React + Vite single-page app | AD8, AD17, AD18 |
| [0009](adr/0009-local-cache-offline-encryption.md) | Encrypted local cache and offline support | AD9, AD20 |
| [0010](adr/0010-connector-behaviour-and-sync.md) | Connector behaviour and saving and syncing | AD10, AD10a |
| [0011](adr/0011-model-providers-and-keys.md) | Model providers and keys | AD11 |
| [0012](adr/0012-langchain-langgraph-pipelines.md) | LangChain.js + LangGraph.js for AI pipelines | AD11a |
| [0013](adr/0013-connectors-and-relay.md) | Connectors in the repo; a relay that stores nothing | AD12, AD21 |
| [0014](adr/0014-practical-tasks-ai-review-first.md) | Practical tasks judged by AI review first | AD13 |
| [0015](adr/0015-translation-and-ui-components.md) | Translation and UI components | AD14 |
| [0016](adr/0016-skill-records-and-overall-level.md) | One file per skill; overall level by AI only | Data model §6 |
| [0017](adr/0017-human-readable-user-data.md) | Everything in the user's storage is human-readable | Data model §0 |
| [0018](adr/0018-tsdoc-api-reference-and-typed-results.md) | TSDoc on every export, a generated API reference, and typed results | AD23 |

## Principle: no server where possible, a relay where necessary

The core runs entirely in the browser. Some outside services don't allow direct browser access (CORS) or need a server-held secret for OAuth. Those go through the **relay**, a small service that stores nothing between requests.

| Service | Direct from browser? | Notes |
|---|---|---|
| Anthropic | Yes | Needs the browser-access opt-in header |
| OpenAI, OpenRouter | Yes | |
| Ollama, LM Studio (local) | Yes | The user allows the app's address in the local server settings |
| Local folder / Obsidian | Yes | Chromium browsers |
| GitHub | Yes with a personal token | Signing in with OAuth needs the relay |
| Google Drive | Yes | Google's browser sign-in flow |
| Notion | **No** | No browser access, and its OAuth needs a server-held secret, so it needs the relay |
| Fetching web pages (job ads, course pages) | **No** | Needs the relay |

*This table is to be confirmed with a quick test of each service before implementation.*

## Decisions

| ID | Decision | Choice | Trade-off accepted |
|---|---|---|---|
| AD1 | **App shape** | A **web app** for now. A desktop wrapper is not planned. | Opening a real local folder works only in Chromium browsers; other browsers rely on other connectors. |
| AD2 | **Language** | **TypeScript** everywhere: core, UI, relay and shared schemas. | Gives up the extra speed of a compiled core, which personal-scale use doesn't need. |
| AD3 | **Code structure** | A **pure core package** (profile model, evidence shape, validation, capability and gap calculation, AI task definitions) with no browser or UI dependencies. Storage connectors, model providers and content sources plug in through small interfaces. The UI and the relay are separate packages in one monorepo. | More structure up front than a single app folder. |
| AD4 | **AI task model** | Every AI feature is a **named, versioned task definition**: an input schema, a prompt template, an output schema, and label and disclaimer text. App and relay share the definitions. Output is validated against its schema before the user sees it. The relay runs only registered tasks (PRD L3). | Every AI feature takes more up-front work than writing a prompt directly in UI code. |
| AD5 | **Content distribution** | A **default content bundle** ships with the app and works offline. **Additional versioned packs** can be loaded from a URL or a connector, for operator content and newer inventory releases. | Packs need version management and a compatibility check against the app. |
| AD6 | **Record format** | **One standard data shape per record type** (exact fields plus free text); the core only ever sees this shape. **File connectors** (local folder, Obsidian, Git) store each record as **one Markdown file with a YAML block (front matter) at the top**: the fields go in the YAML and the text in the Markdown body. The **Notion connector** maps the same shape to database properties and page content. | YAML needs strict parsing and schema validation; every connector must map faithfully both ways. |
| AD7 | **Schema contract** | Shapes are defined in TypeScript with **Zod**. A **JSON Schema** is generated and published for each format version. Every record carries its format version (for example `schema: evidence/1`), and older records are upgraded automatically when read. | Zod becomes the source of truth, with a build step to publish JSON Schema. |
| AD8 | **UI framework** | **React + Vite**, built as a static single-page app. No server-side framework. | A larger bundle than lighter frameworks. |
| AD9 | **Local cache and offline** | A cache on the device in **IndexedDB**. It is never the master copy, can always be rebuilt from storage, and the user can clear it. The app shell and default content are cached so **minimal mode opens offline**. With remote storage, changes made offline are queued until the connection returns. | The cache must be kept consistent with storage (see AD10). |
| AD10 | **Connector behaviour** | **One storage backend per profile at a time.** There is no syncing between backends; moving a profile is an export and an import. A record changed in storage since it was last read is never silently overwritten: the user is shown both versions and chooses. | Users can't mirror one profile across two backends. |
| AD10a | **Saving and syncing** | **Automatic save**: every change is written straight to storage, or queued in the background for remote storage. A **status indicator** ("Saved", "Saving…", "Offline: 3 changes waiting"). **Automatic refresh** when the app opens or the tab regains focus. A **"Sync now"** button to force it. Conflicts are flagged on the affected record only and never block the app. | Background writing and refreshing make the app more complex than a manual save. |
| AD11 | **Model providers and keys** | Adapters for **Anthropic** and **any OpenAI-compatible API** (OpenAI, OpenRouter, Ollama, LM Studio). More can be added through the same interface. API keys are kept **for the session only** by default, with an opt-in "remember on this device" and a warning. A strict content security policy. | Users with session-only keys re-enter them each session. |
| AD11a | **AI library and pipelines** | **LangChain.js** (core + browser-safe provider packages) and **LangGraph.js**, behind Pharoam's own provider interface. Adaptive pipelines (diagnostics, profile updates, CVs, interview practice) are **LangGraph graphs whose AI nodes are registered tasks** (AD4). User approval uses **interrupts**. **Engine checkpoints live only in the local cache.** The user's storage holds a readable session log, from which Pharoam rebuilds the checkpoint ([data model](design/data-model.md) §0, §10). Never on a server. **LangSmith tracing is off and blocked** by the content security policy. LangChain memory, agents and retrievers are not used. AI code is **loaded only when AI-assisted mode is on**. The Vercel AI SDK is not adopted. Subject to spike S2. | A larger download than lighter libraries; a dependency on how LangChain evolves; a small custom checkpoint store and React streaming hook to write. |
| AD12 | **Connectors and relay** | **All connectors live in Pharoam's repo** as standalone, open-source components. Each has a browser part, plus a relay part only where a service requires one. **The relay processes data in memory and records nothing.** It runs wherever the deployment runs it: the user's own machine (`npx`/Docker on localhost), a self-hosted server, or an operator's server. **The Pharoam project never runs a relay.** Operators must publish modified relay code to their users (AGPL §13), and the privacy notice template states honestly that users are trusting the operator. One TypeScript codebase deploys as a Cloudflare Worker or a Docker image. | Personal users who want Notion or web fetching must run the relay themselves. Users of an operator's deployment can't verify the code it runs. |
| AD13 | **Practical tasks** | Start small: practical tasks (for example code) are **judged by an AI review task**, labelled and disclaimed as AI judgement (PRD D6, E4). **Running code in a sandbox for automatic checks is a future feature.** | No automatic code checks at first, so minimal mode can't check practical tasks. |
| AD14 | **Translation, UI and accessibility** | **react-i18next**, with all interface text in translation files from day one, loaded per language on demand. Content packs carry their own translations. **shadcn/ui** (Radix + Tailwind) is the preferred component base; the **design system and theming will be decided later** with dedicated design tools. Automated accessibility checks (axe) for WCAG 2.2 AA. | — |
| AD15 | **Repo and tooling** *(details revisited during implementation planning)* | pnpm monorepo: `packages/core`, `packages/connector-*`, `packages/provider-*`, `apps/web`, `apps/relay`, `site/`, `content/`, `data/` (with its own licences), `docs/`. Vitest and Playwright for tests; GitHub Actions for CI; GitHub Pages for the official app and the landing page. | — |
| AD16 | **Content pack format** | Pathways, assessment items and skill-inventory entries are written in the **same Markdown + YAML format** (AD6) and checked by the **same Zod schemas** (AD7), in `content/` and `data/`. At build time they are **compiled into a versioned JSON bundle** with a manifest (pack version and minimum app version). Packs loaded at runtime (AD5) use the same compiled format. | A build step for content. |

### Supporting stack

| ID | Decision | Choice | Trade-off accepted |
|---|---|---|---|
| AD17 | **App state and data flow** | **TanStack Query** wraps calls to the core service and refreshes views on its change events; **Zustand** for small UI-only state. | Two small libraries instead of plain React context. |
| AD18 | **Routing** | **TanStack Router** with **hash-based URLs** (`/#/skills/python`), so the app runs on any static host with no server configuration. | Less tidy URLs. |
| AD19 | **Parsing and rendering** | **`yaml`** (eemeli/yaml, YAML 1.2), editing documents so comments, field order and unknown fields survive. **`react-markdown` + `rehype-sanitize`**, raw HTML disabled. | — |
| AD20 | **Local cache library** | **Dexie.js** over IndexedDB, wrapped by the encryption layer ([Security](design/security.md) §8). | — |
| AD21 | **Relay framework** | **Hono**, running unchanged on Cloudflare Workers, Node (Docker) and Bun. | — |
| AD22 | **Runtime version** | **The latest stable Node.js line** (currently **Node 26**, Active LTS from 2026-10-28), pinned via `.nvmrc` and `engines`. Dependencies track their latest stable versions, except where a tool's support lags (ENGINEERING §3). Linting, formatting and other developer tools are decided in Engineering & Agent Standards. | — |
| AD23 | **Code documentation and errors** | **TSDoc on every exported item**, checked by `eslint-plugin-jsdoc` and turned into an API reference by **TypeDoc** in CI. **Expected failures are returned as typed results**; exceptions mean bugs ([ADR-0018](adr/0018-tsdoc-api-reference-and-typed-results.md)). | Every export costs a comment; callers must handle each error kind. |

## Spikes before implementation

Short, throwaway tests that confirm a decision before building on it.

| ID | Spike | Confirms |
|---|---|---|
| S1 | Call each service in the CORS table directly from a browser | The "no server where possible" table |
| S2 | Run a small LangGraph.js graph in the browser with an interrupt; **pause it, discard the checkpoint, and resume from a readable session log alone**; measure download size with AI code loaded only when needed | AD11a |
| S3 | Derive an encryption key from a passkey (WebAuthn PRF) in Chrome, Safari and Firefox, with the passphrase fallback; confirm how a stored non-extractable key is written to disk | [Security](design/security.md) §8 |

## Open decisions

| ID | Decision | Depends on |
|---|---|---|
| AD14a | Design system and UI theming | AD8, AD14 (deferred, to be designed later) |
