---
schema: assessment-item/1
slug: postgresql-3-concurrently
skills: [postgresql]
level: 3
format: mcq
prompt: "You need a new index on a busy production table without blocking writes to it. What do you run?"
options:
  - "CREATE INDEX inside a transaction"
  - "CREATE INDEX CONCURRENTLY"
  - "VACUUM FULL, then CREATE INDEX"
  - "LOCK TABLE in SHARE MODE, then CREATE INDEX"
answer: 1
explanation: "CONCURRENTLY builds the index without the lock that blocks inserts, updates and deletes, at the cost of a slower build."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
