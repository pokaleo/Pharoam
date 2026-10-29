# Pharoam

**An open-source, self-hostable companion for lifelong learning and career navigation.**

Pharoam helps people understand what they know, what they can show, which paths are open to them, and what it would take to follow the one they choose. Pharoam never picks the path for them.

> The lighthouse does not choose the road. It helps people see it.

*Pharos* (the lighthouse of Alexandria) + *roam* (the freedom to explore).

> **Status: v0.1 is live, in its founder trial.** Try it at **[pokaleo.github.io/Pharoam](https://pokaleo.github.io/Pharoam/)**. It keeps an evidence-based skills profile on your own device and shows your gap to a career pathway, with no AI and no server. See the [MVP and release plan](docs/MVP.md).

## Try it

Open **[pokaleo.github.io/Pharoam](https://pokaleo.github.io/Pharoam/)** in a desktop browser. Your profile never leaves your device: the app is static, and Pharoam has no server to send it to.

| Browser | Where your profile is kept |
|---|---|
| Chrome, Edge, Brave, Arc | **A folder you choose** on your computer, as Markdown files you can also open in Obsidian or any editor |
| Safari, Firefox | **The browser's own storage** on your device, as the same files. You can start from a folder you pick, and download a copy as a `.zip` whenever you like. Keep a copy: Safari can delete a site's data after seven days without a visit, unless you add Pharoam to the Dock ([why](docs/adr/0020-browser-storage-where-no-folder.md)) |

What v0.1 does:

- **About you:** a headline, what you're doing now, your country and the pathways you're exploring. Never your name or contact details.
- **Evidence:** projects, jobs, courses and certificates, recorded with a form; you see the file before it's saved.
- **Skills:** your own level for each skill, from a vocabulary of about 300 skills or your own, with every correction and retraction kept in its history.
- **Pathways:** frontend, backend, machine-learning and applied AI engineer, each requirement with its sources.
- **Your gap to a pathway:** each requirement grouped as supported, claimed, below or not in your profile yet. No score, no ranking.
- **Edits made outside Pharoam** are noticed, never overwritten: you see both versions and choose.

Diagnostics, AI assistance and learning plans come in later releases ([MVP](docs/MVP.md)).

## Run it yourself

You need Node 26 and pnpm (the version is pinned in `package.json`).

```sh
pnpm install
pnpm dev          # the app at http://localhost:5173
pnpm build        # a static build in dist/web/, to serve from any static host
pnpm check        # lint, types, tests, the hard-rule scan and the API docs, as CI runs them
pnpm test:e2e     # end-to-end tests in Chromium, WebKit and Firefox, with accessibility checks
```

The app builds without `brand/`, with a neutral look, so forks can follow the AGPL without the Pharoam brand ([TRADEMARKS.md](TRADEMARKS.md)).

| Folder | What's there |
|---|---|
| `packages/core` | The profile model, schemas, record files, shown levels and gaps: no browser or UI code |
| `packages/connector-folder` | Reads and writes the profile's files in a folder, or in the browser's own storage |
| `apps/web` | The web app (React and Vite), with its end-to-end tests in `e2e/` |
| `content/`, `data/` | The pathways and the skill vocabulary, compiled into the app |
| `brand/`, `fonts/` | The design system's finished files and its typefaces, under their own licences |

---

## The idea

At Pharoam's centre is a **personal knowledge profile**, not a static CV. It grows with your studies, work, projects and reflection. Your evidence (jobs, projects, repositories, certificates) is linked to skills, and each skill shows one level that says *where it came from*:

| Label | Meaning |
|---|---|
| `self-reported` | Your own rating |
| `ai-judged` | A level AI gave from your evidence, with an explanation, its limits and a clear AI disclaimer; it counts once you accept it |
| `demonstrated` | Shown in a question-bank diagnostic |
| `ai-correlated` | Shown in an AI-led diagnostic, with an explanation that compares the result with your evidence |

A tested level rests only on what you show: claims and evidence shape a diagnostic's questions and its explanation, never the level itself.

Pharoam builds on that profile in four steps:

1. **Map**: bring in what you've studied and done.
2. **Assess**: turn claims into tested levels through adaptive diagnostics, with or without AI.
3. **Explore**: compare several plausible career pathways, with their prerequisites, gaps, learning investment and trade-offs.
4. **Learn**: follow a personal learning plan and track real progress.

v1 is built for technical, self-directed people, starting with its founder. Computer-science students, recent graduates and early-career learners come next.

## What Pharoam won't do

- Pick a "best career" for you, or rank you with an opaque score.
- Send job applications in bulk.
- Promise jobs, salaries or outcomes.
- Train models on your records by default.
- Hold your data. Your profile lives in storage *you* choose, as readable Markdown files. Pharoam reads and writes it through connectors, and you choose the AI model provider.

## Principles

Every design decision is checked against the rules in the [Charter](docs/CHARTER.md#3-principles-and-design-rules). In brief:

- **The person chooses.**
- **Claims and shown performance are kept apart.**
- **Teach understanding, not application volume.**
- **The profile belongs to the person.**
- **Lifelong and incremental.**

## Project docs

- [Charter & Product Vision](docs/CHARTER.md): what Pharoam is, its design rules, scope and decisions.
- [PRD](docs/PRD.md): the whole product blueprint.
- [MVP and release plan](docs/MVP.md): what each release delivers, its stories and acceptance criteria, and what's deferred.
- [Implementation plan](docs/ROADMAP.md): the order of work.
- [Architecture](docs/ARCHITECTURE.md): decisions and the [ADR](docs/adr/) index.
- Design specifications: [data model](docs/design/data-model.md), [interfaces](docs/design/interfaces.md), [security](docs/design/security.md).
- Research: [existing tools and differentiation](docs/research/discovery.md), [skill inventories](docs/research/skills-inventory.md).
- [Engineering standards](docs/ENGINEERING.md) and [AGENTS.md](AGENTS.md) (instructions for AI coding agents).

## Contributing

Pharoam is at an early stage and **does not accept outside pull requests yet**. Issues, ideas and discussion are very welcome. Contributor terms will be published before outside code is accepted.

## Licence

- **Code:** [GNU Affero General Public License v3.0 only](LICENSE) (`AGPL-3.0-only`).
- **Content** (`content/`: pathways): [CC BY-SA 4.0](content/LICENSE).
- **Skill vocabulary** (`data/`: forked from the MIND Tech Ontology): [MIT](data/LICENSE).
- **JSON Schemas for the file formats** (`schemas/`): [CC0 1.0](schemas/LICENSE).
- **Name, logo and design system:** the founder's own assets. They are not open source and not covered by the code licence; the design system is kept outside this repository. See the [trademark and brand policy](TRADEMARKS.md).
- **Third-party libraries, fonts, icons and data:** their own licences.

Which licence covers what, and where the boundary between the code and the brand lies: [LICENSING.md](LICENSING.md).
