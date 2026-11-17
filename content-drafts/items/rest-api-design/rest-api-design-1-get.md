---
schema: assessment-item/1
slug: rest-api-design-1-get
skills: [rest-api-design]
level: 1
format: mcq
prompt: "In a REST API that follows common conventions, which request fetches the order with ID 42?"
options:
  - "GET /orders/42"
  - "POST /orders/42"
  - "DELETE /orders/42"
  - "PUT /orders"
answer: 0
explanation: "GET reads a resource, identified by its collection and ID in the path."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
