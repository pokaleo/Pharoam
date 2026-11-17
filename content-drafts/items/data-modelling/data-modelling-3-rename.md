---
schema: assessment-item/1
slug: data-modelling-3-rename
skills: [data-modelling]
level: 3
format: mcq
prompt: "A column used by the running app must be renamed, without downtime. What is the safe order?"
options:
  - "Rename it in one migration while the app is running"
  - "Add the new column, write to both, backfill, switch reads to the new one, then drop the old"
  - "Stop all writes, rename it, then deploy the app"
  - "Create a view with the new name, then drop the table"
answer: 1
explanation: "Expand, migrate, then contract: old and new code both work at every step."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
