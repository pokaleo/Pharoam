---
schema: assessment-item/1
slug: postgresql-2-index
skills: [postgresql]
level: 2
format: mcq
prompt: "A query on a large table filters by email, and it is slow. What usually helps most?"
options:
  - "A larger connection pool"
  - "Running VACUUM FULL every hour"
  - "An index on the email column"
  - "A CHECK constraint on email"
answer: 2
explanation: "Without an index, PostgreSQL has to read every row to find matching emails."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
