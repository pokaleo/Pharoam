---
schema: assessment-item/1
slug: sql-3-index
skills: [sql]
level: 3
format: mcq
prompt: "A query on a large orders table filters with WHERE customer_id = ? AND created_at > ?, and its plan shows a full scan. Which index helps it most?"
options:
  - "A composite index on (customer_id, created_at)"
  - "A composite index on (created_at, customer_id)"
  - "Two separate indexes, on customer_id and on created_at"
  - "An index on created_at alone"
answer: 0
explanation: "Putting the equality column first, then the range column, lets the index find exactly the matching rows."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-15T01:52:45Z
---
