---
schema: assessment-item/1
slug: postgresql-4-long-transaction
skills: [postgresql]
level: 4
format: mcq
prompt: "A constantly updated table keeps growing on disk, and autovacuum runs but frees little. What is the most likely cause to check first?"
options:
  - "Too many indexes, as each stores a full copy of every row"
  - "A long-running transaction holding back the oldest snapshot, so dead rows can't be removed"
  - "A fillfactor of 100, which stops vacuum from running"
  - "The write-ahead log being on the same disk as the table"
answer: 1
explanation: "Vacuum can only remove row versions no open transaction might still see; check pg_stat_activity for old transactions."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
