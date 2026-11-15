---
schema: assessment-item/1
slug: sql-2-left-join
skills: [sql]
level: 2
format: mcq
prompt: "Which join keeps every row of the left table, with NULLs where the right table has no match?"
options:
  - "LEFT JOIN"
  - "INNER JOIN"
  - "CROSS JOIN"
  - "RIGHT JOIN"
answer: 0
explanation: "A LEFT JOIN keeps all left rows; an INNER JOIN drops unmatched rows, and a CROSS JOIN pairs every row with every row."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-15T01:52:45Z
---
