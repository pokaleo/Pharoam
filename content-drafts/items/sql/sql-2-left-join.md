---
schema: assessment-item/1
slug: sql-2-left-join
skills: [sql]
level: 2
format: mcq
prompt: "In SELECT c.name, o.id FROM customers c ___ orders o ON o.customer_id = c.id, which join lists every customer, including those with no orders?"
options:
  - "LEFT JOIN"
  - "INNER JOIN"
  - "CROSS JOIN"
  - "RIGHT JOIN"
answer: 0
explanation: "A LEFT JOIN keeps every row of the first-named table, filling the other table's columns with NULL where nothing matches."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-15T01:52:45Z
---
