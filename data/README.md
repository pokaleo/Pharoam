# Data

Pharoam's **skill vocabulary**: the skills that evidence, observations and pathways refer to, with their stable slugs, the shared level scale and skill-specific level descriptions (PRD I1, ADR-0005).

Files are Markdown with a YAML top block, checked by the `skill` schema and compiled into the built-in content bundle (AD16). Each file's `origin` field names its source and licence (data model §11).

## Licence

**MIT**, not the AGPL that covers the code. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

The vocabulary is forked from the [MIND Tech Ontology](https://github.com/MIND-TechAI/MIND-tech-ontology) (MIT). Pharoam's own changes and additions are MIT too, so the whole vocabulary stays under one licence.

## What's here

- **`levels.md`**: the shared level scale, 0 aware · 1 beginner · 2 working · 3 proficient · 4 expert (Charter P14), with what each level means.
- **`skills/<slug>.md`**: one file per skill (`skill/1`). The file is named after the skill's slug, which never changes once published.
- **Skill-specific levels** (`levels` in a skill file): what each level 0–4 means for that skill, for the skills the pathways require (MVP §3). They are Pharoam's own, drafted with AI and reviewed by the founder before they are merged (PRD I3). Without them, the shared descriptions in `levels.md` apply.

The v0.1 vocabulary is about 300 skills chosen for the four v0.1 pathways (frontend, backend, machine-learning and applied AI engineer), from three sources. Each file's `origin` says which:

| Source | What | `origin` |
|---|---|---|
| MIND Tech Ontology skills | Tools, languages, frameworks, databases and services, with MIND's synonyms as `aliases` and its "implies knowing" links as `relations` where both skills are here | MIND, linked to `__aggregated_skills.json` at the commit used |
| MIND Tech Ontology concepts | Practices such as REST API design, test-driven development and retrieval-augmented generation, from MIND's concept files, under plain names (MIND's own label is kept as an alias) | MIND, linked to the concept file at the commit used |
| Pharoam | Foundations MIND doesn't list (statistics, linear algebra, algorithms, system design, accessibility…) and current tools added after MIND's last update (Linux, Vitest, Zod, Ollama, the Model Context Protocol…) | `Pharoam` |

Every skill sits in one of a few **domains** (Foundations, Programming languages, Frontend, Backend, Databases, Data and machine learning, AI and language models, Cloud and DevOps, Testing and quality, Architecture and design, Security), which the skill view can filter by (MVP S9.3).

The MIND material comes from commit `2367527` (12 February 2025), MIND's latest. `tooling/content.test.ts` checks every file on each change: it validates against its schema, is named after its slug, and links only to skills that exist.

## Adding data from another source

Data licences can't always be mixed. Before adding anything here:

1. **Check the licence.** Only add data whose licence allows redistribution and changes. Not allowed: roadmap.sh, Lightcast Open Skills and SFIA ([research](../docs/research/skills-inventory.md)).
2. **Keep other licences apart.** Data under any licence other than MIT goes in its own subfolder, with its own LICENSE and NOTICE files. Share-alike data, such as the appliedAI AI Skills Framework (CC BY-SA 4.0), must never be merged into the MIT files.
3. **Credit the source** in NOTICE and in each file's `origin` field, and say what Pharoam changed.
4. **List the licence in the bundle manifest** (`licences`, one per source; data model §11), so the app can show it.

### ESCO

ESCO is reused under the [Commission Decision on the reuse of Commission documents (2011/833/EU)](https://esco.ec.europa.eu/en/about-esco/faq). When ESCO data is added (planned for the full vocabulary pipeline, MVP §7):

- The app must show: "This service uses the [ESCO classification](https://esco.ec.europa.eu) of the European Commission."
- Anything Pharoam changes or adapts from ESCO must be clearly marked as changed.
- NOTICE gains an ESCO entry with the ESCO version used.
