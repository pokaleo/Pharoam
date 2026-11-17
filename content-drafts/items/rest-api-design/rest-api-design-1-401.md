---
schema: assessment-item/1
slug: rest-api-design-1-401
skills: [rest-api-design]
level: 1
format: mcq
prompt: "An API replies 401 Unauthorized to your request. What should you check first?"
options:
  - "That the URL exists"
  - "That the server has enough disk space"
  - "That you sent valid credentials, such as an API key or token"
  - "That the request body is small enough"
answer: 2
explanation: "401 means the request wasn't authenticated: credentials were missing or not accepted."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
