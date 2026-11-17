---
schema: assessment-item/1
slug: postgresql-3-expression-index
skills: [postgresql]
level: 3
format: mcq
prompt: "EXPLAIN ANALYZE shows a Seq Scan for WHERE lower(email) = $1 on a 10-million-row table, though email has an index. Why, and what fixes it?"
options:
  - "The index is corrupt; rebuild it with REINDEX"
  - "Statistics are stale; run ANALYZE on the table"
  - "It indexes email, not lower(email); add an expression index"
  - "lower() blocks indexes; use email ILIKE $1 instead"
answer: 2
explanation: "An index is only used for the expression it was built on, so the query needs an expression index."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
