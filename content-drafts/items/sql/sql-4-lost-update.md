---
schema: assessment-item/1
slug: sql-4-lost-update
skills: [sql]
level: 4
format: mcq
prompt: "Two transactions at READ COMMITTED each read an account's balance, add to it in the app and write it back. What can go wrong, and what prevents it?"
options:
  - "A guaranteed deadlock; nothing prevents it"
  - "Nothing; READ COMMITTED serialises the two writes"
  - "A lost update; lock the row with SELECT … FOR UPDATE, or update atomically with SET balance = balance + ?"
  - "A dirty read; READ UNCOMMITTED prevents it"
answer: 2
explanation: "Both read the old balance, so the second write overwrites the first; locking or an atomic update keeps both changes."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-15T01:52:45Z
---
