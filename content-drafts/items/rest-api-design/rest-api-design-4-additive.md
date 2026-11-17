---
schema: assessment-item/1
slug: rest-api-design-4-additive
skills: [rest-api-design]
level: 4
format: mcq
prompt: "An organisation evolves one API version with only additive changes, instead of new URL versions such as /v2. What does that rely on most?"
options:
  - "Clients ignoring unknown fields, old fields keeping their meaning"
  - "Clients sending a version header with each request"
  - "Every client upgrading in step with the server"
  - "The server keeping a build of each past release"
answer: 0
explanation: "Additive evolution works only if old clients tolerate new fields and old fields keep their meaning."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
