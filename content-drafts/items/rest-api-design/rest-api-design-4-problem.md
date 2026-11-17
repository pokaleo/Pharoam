---
schema: assessment-item/1
slug: rest-api-design-4-problem
skills: [rest-api-design]
level: 4
format: mcq
prompt: "Teams across an organisation each return errors in their own shape. Which standard could they adopt?"
options:
  - "Problem Details for HTTP APIs (RFC 9457)"
  - "OAuth 2.0's error response (RFC 6749)"
  - "HTTP's Warning header"
  - "The GraphQL specification's errors list"
answer: 0
explanation: "RFC 9457, which replaced RFC 7807, defines one JSON shape for any HTTP API's errors: type, title, status, detail and instance."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
