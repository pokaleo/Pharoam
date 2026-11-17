---
schema: assessment-item/1
slug: postgresql-4-wraparound
skills: [postgresql]
level: 4
format: mcq
prompt: "PostgreSQL logs warnings about transaction ID wraparound. What prevents it?"
options:
  - "Restarting the server, which resets the transaction ID counter"
  - "Raising max_connections"
  - "Switching the busiest tables to UNLOGGED"
  - "Vacuuming that freezes old rows, so their transaction IDs can safely be reused"
answer: 3
explanation: "Transaction IDs are 32-bit and wrap around; freezing marks old rows as visible to all, so their IDs no longer matter."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
