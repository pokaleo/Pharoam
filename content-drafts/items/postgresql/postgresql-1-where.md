---
schema: assessment-item/1
slug: postgresql-1-where
skills: [postgresql]
level: 1
format: mcq
prompt: "Which query returns only the users named Ana?"
options:
  - "SELECT * FROM users WHERE name = \"Ana\";"
  - "SELECT users WHERE name = 'Ana';"
  - "SELECT * FROM users WHERE name = 'Ana';"
  - "GET * FROM users IF name = 'Ana';"
answer: 2
explanation: "Text values take single quotes; in PostgreSQL, double quotes name a column or table instead."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
