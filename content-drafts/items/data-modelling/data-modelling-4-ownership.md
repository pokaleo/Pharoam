---
schema: assessment-item/1
slug: data-modelling-4-ownership
skills: [data-modelling]
level: 4
format: mcq
prompt: "Several teams need customer data, and each owns its own service and database. What keeps their models consistent without one shared database?"
options:
  - "One team owns the customer record and publishes its changes as events, from which others keep their own copies"
  - "Every service writes directly to every other service's database"
  - "A nightly copy of one team's whole database into all the others"
  - "Each team keeps its own customer data and never shares it"
answer: 0
explanation: "A single owner with published changes keeps one source of truth while letting each team model what it needs."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
