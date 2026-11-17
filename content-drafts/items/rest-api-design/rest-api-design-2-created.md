---
schema: assessment-item/1
slug: rest-api-design-2-created
skills: [rest-api-design]
level: 2
format: mcq
prompt: "A client creates an order with POST /orders. What is the clearest successful response?"
options:
  - "200 OK with an empty body"
  - "204 No Content, with the new order in the body"
  - "201 Created, with a Location header giving the new order's URL"
  - "302 Found, redirecting to /orders"
answer: 2
explanation: "201 says something was created, and Location tells the client where to find it."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
