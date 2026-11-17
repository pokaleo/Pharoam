---
schema: assessment-item/1
slug: rest-api-design-3-compatible
skills: [rest-api-design]
level: 3
format: mcq
prompt: "Which change to a public API's responses can break existing clients, even though it only adds something?"
options:
  - "Adding an optional field"
  - "Adding a new value to an enum field"
  - "Adding a new endpoint"
  - "Adding a response header"
answer: 1
explanation: "Clients that handle a fixed set of values can fail on one they've never seen, so a new enum value needs the care of a breaking change."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
