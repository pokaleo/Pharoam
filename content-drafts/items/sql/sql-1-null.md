---
schema: assessment-item/1
slug: sql-1-null
skills: [sql]
level: 1
format: mcq
prompt: "Which condition finds the rows whose email has no value (NULL)?"
options:
  - "WHERE email = NULL"
  - "WHERE email == ''"
  - "WHERE email IS NULL"
  - "WHERE NOT email"
answer: 2
explanation: "NULL isn't equal to anything, not even NULL, so = NULL never matches; IS NULL tests for it."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-15T01:52:45Z
---
