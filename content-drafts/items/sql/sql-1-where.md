---
schema: assessment-item/1
slug: sql-1-where
skills: [sql]
level: 1
format: mcq
prompt: "Which query returns only the customers whose country is 'FR'?"
options:
  - "SELECT * FROM customers IF country = 'FR';"
  - "SELECT * FROM customers WHERE country = 'FR';"
  - "SELECT * WHERE country = 'FR' FROM customers;"
  - "SELECT country = 'FR' FROM customers;"
answer: 1
explanation: "WHERE filters rows and comes after FROM; IF isn't a clause of SELECT."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-15T01:52:45Z
---
