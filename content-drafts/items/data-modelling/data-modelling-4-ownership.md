---
schema: assessment-item/1
slug: data-modelling-4-ownership
skills: [data-modelling]
level: 4
format: mcq
prompt: "Several teams need customer data, and each owns its own service and database. What keeps their models consistent without one shared database?"
options:
  - "Each team copies the others' customer tables nightly"
  - "Each team keeps its own record, reconciled monthly"
  - "One team owns the record and publishes its changes as events"
  - "Every service reads and writes the others' tables directly"
answer: 2
explanation: "A single owner with published changes keeps one source of truth while letting each team model what it needs."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
