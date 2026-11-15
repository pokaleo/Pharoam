---
schema: assessment-item/1
slug: sql-1-order
skills: [sql]
level: 1
format: mcq
prompt: "Which clause, added to SELECT name, price FROM products, lists the products from most to least expensive?"
options:
  - "ORDER BY price ASC"
  - "SORT BY price DOWN"
  - "GROUP BY price DESC"
  - "ORDER BY price DESC"
answer: 3
explanation: "ORDER BY sorts the result, and DESC sorts from highest to lowest; ASC is the reverse."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-15T01:52:45Z
---
