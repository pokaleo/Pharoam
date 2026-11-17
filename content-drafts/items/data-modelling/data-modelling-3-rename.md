---
schema: assessment-item/1
slug: data-modelling-3-rename
skills: [data-modelling]
level: 3
format: mcq
prompt: "A column used by the running app must be renamed, without downtime. What is the safe order?"
options:
  - "Rename it in a migration, then deploy the app using the new name"
  - "Deploy the app using the new name, then run the rename"
  - "Add the new column, backfill it, deploy the app using it, drop the old"
  - "Add the new column, write to both, backfill, switch reads, drop the old"
answer: 3
explanation: "Writing to both before the backfill means no write is lost while old and new code run side by side."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
