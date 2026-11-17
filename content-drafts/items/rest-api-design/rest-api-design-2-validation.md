---
schema: assessment-item/1
slug: rest-api-design-2-validation
skills: [rest-api-design]
level: 2
format: mcq
prompt: "A request's JSON is well-formed, but its email field isn't an email address. Which response suits it best?"
options:
  - "500 Internal Server Error, with the exception's message"
  - "404 Not Found, naming the field it couldn't find"
  - "400 Bad Request, naming the field and the problem"
  - "200 OK, with an error flag and message in the body"
answer: 2
explanation: "The client sent invalid data, so a 4xx code with a body naming the field lets it fix the request."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
