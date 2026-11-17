---
schema: assessment-item/1
slug: rest-api-design-4-sunset
skills: [rest-api-design]
level: 4
format: mcq
prompt: "Many outside teams use a field that must be removed from a public API. What is the soundest approach?"
options:
  - "Remove it in the next release and note it in the changelog"
  - "Return null in it from now on, so clients notice"
  - "Deprecate it, set a date, watch usage, then remove it"
  - "Move it to /v2 and switch /v1 off the same day"
answer: 2
explanation: "Announcing a date, for example with Deprecation and Sunset headers, and watching usage lets clients move before anything breaks."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
