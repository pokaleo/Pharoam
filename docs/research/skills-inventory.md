# Research: open skill inventories to reuse

| | |
|---|---|
| **Date** | 24 October 2026 |
| **Feeds** | [PRD](../PRD.md) I1 |
| **Status** | Findings. The decision is still open. |

**Question:** is there an open-source skill inventory Pharoam can reuse and extend as its own? The fast pace of change in AI-era skills makes building one from scratch unattractive.

**Answer:** no single open dataset is enough. The best fit is to combine several.

## Ruled out

| Candidate | Why it's ruled out |
|---|---|
| roadmap.sh (`developer-roadmap`) | Custom all-rights-reserved licence: personal use only, and republishing is forbidden |
| Lightcast Open Skills | No published licence; API-only; production or for-profit use needs a commercial licence |
| SFIA | Every use needs a SFIA Foundation licence; the free licence bars distribution |
| skills-ml / Open Skills API | Not-for-profit research use only |
| Stack Overflow tags | Dump access restricted since 2024; the terms forbid LLM training |

## Shortlist

| Candidate | Licence | Strength | Weakness |
|---|---|---|---|
| [MIND Tech Ontology](https://github.com/MIND-TechAI/MIND-tech-ontology) | MIT | About 3.3k tech skills with synonyms, "implies knowing" relations and domains, in JSON | Unchanged since Feb 2025, so Pharoam would become its maintainer |
| [ESCO](https://esco.ec.europa.eu) v1.2.1 | EU reuse decision (attribution, mark changes) | Stable occupations ↔ skills, permanent URIs, 28 languages | Weak on modern tech and AI (no LLM, Kubernetes, Docker or PyTorch found in v1.1.1) |
| [GitHub Explore topics](https://github.com/github/explore) | CC BY 4.0 | Very current (llm, rag, mcp…), aliases and related topics, very active | A flat list, not a taxonomy |
| [Wikidata](https://www.wikidata.org) | CC0 | Durable IDs for cross-referencing | Uneven coverage |
| [appliedAI AI Skills Framework](https://github.com/aai-institute/ai-skills-framework) | CC BY-SA 4.0 | 161 AI competencies, each with **5 proficiency levels** | Share-alike: must be kept as a separate data file |
| [O\*NET](https://www.onetcenter.org) | CC BY 4.0 (with trademark rules) | Occupations with skill levels and "hot technology" flags | US-focused; names products rather than skills |

## Recommended shape

1. **Fork MIND** into a Pharoam-owned inventory. Every skill gets a stable Pharoam ID, cross-referenced to an ESCO URI, a Wikidata ID and a GitHub topic slug where they exist.
2. **ESCO** (plus O\*NET if wanted) provides the slow-changing layer of occupations and transferable skills that career pathways build on.
3. **Regular refresh** (for example quarterly): compare against GitHub Explore topics and Wikidata to find new AI-era skills, then accept them through human-reviewed changes.
4. **appliedAI** provides AI competencies and a template for proficiency levels, kept in its own CC BY-SA file.
5. **Data licences stay separate from the code:** a `data/` folder with its own LICENSE and NOTICE files, plus the required ESCO attribution in the app.

## Risks

- **Pharoam owns the upkeep.** Its sources are stale or one-off releases, so the refresh process must exist from the start.
- **Licences can mix.** CC BY-SA data must not be merged into the MIT and CC BY files.
- **Mapping is real work.** Matching about 3.3k tech skills to about 13.9k ESCO skills is many-to-many; it needs AI-assisted mapping with human checking.

## Not verified

- SWEBOK and ACM CCS reuse terms.
- The content licence for Open Skills Network RSDs.
- Lightcast's full terms.
- ESCO v1.2's AI coverage (only v1.1.1 was tested).
