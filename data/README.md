# Data

Pharoam's **skill vocabulary**: the skills that evidence, observations and pathways refer to, with their stable slugs, the shared level scale and skill-specific level descriptions (PRD I1, ADR-0005).

Files are Markdown with a YAML top block, checked by the `skill` schema and compiled into the built-in content bundle (AD16). Each file's `origin` field names its source and licence (data model §11).

## Licence

**MIT**, not the AGPL that covers the code. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

The vocabulary is forked from the [MIND Tech Ontology](https://github.com/MIND-TechAI/MIND-tech-ontology) (MIT). Pharoam's own changes and additions are MIT too, so the whole vocabulary stays under one licence.

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
