---
schema: assessment-item/1
slug: rest-api-design-1-pattern
skills: [rest-api-design]
level: 1
format: mcq
prompt: "An API has GET /users and GET /users/{id}. Following the same pattern, how would you list one user's orders?"
options:
  - "GET /getUserOrders/{id}"
  - "POST /users/{id}?action=orders"
  - "GET /orders/users/list/{id}"
  - "GET /users/{id}/orders"
answer: 3
explanation: "Nesting the orders under the user they belong to keeps paths as nouns, in the pattern already there."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
