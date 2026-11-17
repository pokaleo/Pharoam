---
schema: assessment-item/1
slug: rest-api-design-3-put-patch
skills: [rest-api-design]
level: 3
format: mcq
prompt: "A request to /users/42 times out. By HTTP semantics, which can the client safely send again?"
options:
  - "PUT with the user's full new state"
  - "POST adding a new address"
  - "PATCH appending a tag to a list"
  - "POST with the same body as before"
answer: 0
explanation: "PUT is idempotent: sending the same full state twice leaves the resource as sending it once."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
