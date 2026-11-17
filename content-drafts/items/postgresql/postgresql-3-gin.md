---
schema: assessment-item/1
slug: postgresql-3-gin
skills: [postgresql]
level: 3
format: mcq
prompt: "Queries filter a JSONB column with data @> '{\"status\": \"paid\"}'. Which index supports that operator?"
options:
  - "A GIN index on the column"
  - "A B-tree index on the column"
  - "A hash index on the column"
  - "A BRIN index on the column"
answer: 0
explanation: "GIN indexes the keys and values inside JSONB, which containment (@>) needs."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
