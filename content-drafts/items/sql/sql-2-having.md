---
schema: assessment-item/1
slug: sql-2-having
skills: [sql]
level: 2
format: mcq
prompt: "Which query lists the customers with more than 5 orders, with their count?"
options:
  - "SELECT customer_id, COUNT(*) FROM orders WHERE COUNT(*) > 5 GROUP BY customer_id;"
  - "SELECT customer_id, COUNT(*) FROM orders GROUP BY customer_id WHERE COUNT(*) > 5;"
  - "SELECT customer_id, COUNT(*) > 5 FROM orders;"
  - "SELECT customer_id, COUNT(*) FROM orders GROUP BY customer_id HAVING COUNT(*) > 5;"
answer: 3
explanation: "WHERE filters rows before grouping, so it can't use an aggregate; HAVING filters the groups after."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-15T01:52:45Z
---
