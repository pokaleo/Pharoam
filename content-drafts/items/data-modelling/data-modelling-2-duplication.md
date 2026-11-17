---
schema: assessment-item/1
slug: data-modelling-2-duplication
skills: [data-modelling]
level: 2
format: mcq
prompt: "Each employee row repeats their department's name and budget code. What problem does that cause?"
options:
  - "Employees can no longer be joined to departments"
  - "The database rejects text repeated across rows"
  - "Renaming a department means updating many rows, or they disagree"
  - "Department names can no longer be indexed"
answer: 2
explanation: "A fact stored in many rows can drift apart when it changes, so normalising keeps it in one place."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
