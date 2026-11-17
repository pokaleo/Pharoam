---
schema: assessment-item/1
slug: rest-api-design-2-pagination
skills: [rest-api-design]
level: 2
format: mcq
prompt: "GET /orders could match a million orders. What should the endpoint do?"
options:
  - "Return them all and let the client filter"
  - "Return the first 100 and say nothing about the rest"
  - "Refuse the request with 413 Payload Too Large"
  - "Return one page at a time, with a limit and a cursor or offset for the next page"
answer: 3
explanation: "Pagination keeps responses small and tells the client how to get the rest."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
