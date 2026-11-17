---
schema: assessment-item/1
slug: postgresql-4-standby-feedback
skills: [postgresql]
level: 4
format: mcq
prompt: "Long queries on a hot standby keep being cancelled with \"conflict with recovery\". Which setting prevents most of these, at the cost of possible bloat on the primary?"
options:
  - "hot_standby_feedback = on"
  - "synchronous_commit = remote_apply"
  - "wal_level = logical"
  - "A higher max_wal_senders"
answer: 0
explanation: "hot_standby_feedback tells the primary which rows the standby's queries still need, so vacuum keeps them there."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
