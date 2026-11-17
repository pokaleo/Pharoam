---
schema: assessment-item/1
slug: rest-api-design-2-validation
skills: [rest-api-design]
level: 2
format: mcq
prompt: "A request's JSON is well-formed, but its email field isn't an email address. Which response suits it best?"
options:
  - "500 Internal Server Error"
  - "404 Not Found"
  - "400 Bad Request (or 422), with a body naming the field and the problem"
  - "200 OK, with an error message in the body"
answer: 2
explanation: "It's the client's mistake, so a 4xx code, with a machine-readable error the client can act on."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
