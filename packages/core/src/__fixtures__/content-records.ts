// Example content record files for the schema tests, following data model §11.

/** A skill inventory entry with skill-specific level descriptions. */
export const SKILL_FILE = `---
schema: skill/1
slug: python
name: Python
aliases: [Python 3, CPython]
description: A general-purpose programming language.
domain: Programming languages
relations:
  implies: []
  related: [django, pandas]
levels:
  0: Has not used Python.
  1: Can read and change small scripts with help.
  2: Writes working scripts and small programs on their own.
  3: Builds and maintains production Python code, with tests and packaging.
  4: Shapes how a team uses Python; knows the runtime and ecosystem in depth.
refs:
  esco: http://data.europa.eu/esco/skill/ccd0a1d9-afda-43d9-b901-96344886e14d
  wikidata: Q28865
  github_topic: python
origin:
  source: MIND Tech Ontology
  url: https://github.com/MIND-TechAI/MIND-tech-ontology
  licence: MIT
status: active
---
`;

/** A reviewed pathway that AI drafted. */
export const PATHWAY_FILE = `---
schema: pathway/1
slug: ml-engineer
title: Machine-learning engineer
summary: Builds, ships and runs machine-learning systems in production.
requirements:
  - skill: python
    level: 3
    importance: core
    sources:
      - title: Survey of machine-learning engineer job adverts, 2026
        url: https://example.com/ml-engineer-adverts-2026
        accessed: 2026-10-20
  - skill: pytorch
    level: 3
    importance: core
    sources:
      - title: Survey of machine-learning engineer job adverts, 2026
  - skill: docker
    level: 2
    importance: helpful
    sources:
      - title: Survey of machine-learning engineer job adverts, 2026
prerequisites:
  - Comfortable with linear algebra and probability.
transferable: [python, sql]
uncertainties:
  - Demand for specialised roles shifts quickly as tooling changes.
investment:
  time:
    min: 6
    max: 18
    unit: months
    sources:
      - title: Bootcamp and degree course lengths, 2026
  cost:
    min: 0
    max: 3000
    currency: GBP
    region: GB
    sources:
      - title: Course price survey, 2026
occupations:
  - http://data.europa.eu/esco/occupation/a2f5d2b9-47ab-4e8f-8d6b-58e1f6a52a2c
review:
  by: The Pharoam founder
  at: 2026-10-27
ai:
  task: draft-pathway@1
  model: anthropic/claude-sonnet-5-5
  at: 2026-10-26T10:00:00Z
---
`;

/** The manifest of the built-in content pack. */
export const PACK_FILE = `---
schema: pack/1
name: pharoam-core
version: 0.1.0
min_app_version: 0.1.0
publisher: The Pharoam authors
licences:
  - source: MIND Tech Ontology
    licence: MIT
    attribution: Copyright (c) 2025 or-mihai-or-gheorghe
    url: https://github.com/MIND-TechAI/MIND-tech-ontology
  - source: Pharoam content
    licence: CC-BY-SA-4.0
contents:
  skills: [python, pytorch, docker, sql]
  pathways: [ml-engineer]
translations: [en]
---
`;
