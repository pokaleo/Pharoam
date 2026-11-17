---
schema: assessment-item/1
slug: rest-api-design-3-compatible
skills: [rest-api-design]
level: 3
format: mcq
prompt: "Which change to a public API's response is backward-compatible for well-written clients?"
options:
  - "Renaming a field"
  - "Adding a new optional field"
  - "Changing a field from a number to a string"
  - "Removing a field that clients don't seem to use"
answer: 1
explanation: "Clients that ignore unknown fields keep working; renaming, retyping or removing fields breaks them."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
