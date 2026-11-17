---
schema: assessment-item/1
slug: postgresql-4-async-failover
skills: [postgresql]
level: 4
format: mcq
prompt: "With asynchronous streaming replication, what can a failover to the replica lose?"
options:
  - "Nothing: an asynchronous replica is always up to date"
  - "Transactions committed on the primary whose WAL hadn't reached the replica yet"
  - "Only transactions that were never committed"
  - "The replica's indexes, which must then be rebuilt"
answer: 1
explanation: "The primary confirms commits without waiting for the replica, so the last moments of WAL can be lost."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
