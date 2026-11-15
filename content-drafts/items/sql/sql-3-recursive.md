---
schema: assessment-item/1
slug: sql-3-recursive
skills: [sql]
level: 3
format: mcq
prompt: "What is a recursive CTE (WITH RECURSIVE) typically used for?"
options:
  - "Making any query faster by caching its result"
  - "Creating a permanent table"
  - "Locking rows for the length of a transaction"
  - "Walking a hierarchy, such as an employee's chain of managers"
answer: 3
explanation: "A recursive CTE repeats a query on its own previous result, which follows parent-child links to any depth."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-15T01:52:45Z
---
