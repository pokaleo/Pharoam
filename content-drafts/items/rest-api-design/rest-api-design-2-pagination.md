---
schema: assessment-item/1
slug: rest-api-design-2-pagination
skills: [rest-api-design]
level: 2
format: mcq
prompt: "GET /orders could match a million orders. What should the endpoint do?"
options:
  - "Return every order and let the client filter"
  - "Return the newest 100, without saying more exist"
  - "Refuse it with 413 Content Too Large"
  - "Return a page, with a cursor or link to the next"
answer: 3
explanation: "Pagination keeps responses small and tells the client how to get the rest."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
