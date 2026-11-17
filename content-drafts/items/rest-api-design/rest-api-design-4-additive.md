---
schema: assessment-item/1
slug: rest-api-design-4-additive
skills: [rest-api-design]
level: 4
format: mcq
prompt: "An organisation evolves one API version with only additive changes, instead of new URL versions such as /v2. What does that rely on most?"
options:
  - "Clients ignoring fields they don't know, and existing fields never being removed or changing meaning"
  - "Every client upgrading at the same time as the server"
  - "The server keeping a copy of its code for each past release"
  - "Clients sending their version number in every request"
answer: 0
explanation: "Additive evolution works only if old clients tolerate new fields and old fields keep their meaning."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
