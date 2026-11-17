---
schema: assessment-item/1
slug: postgresql-2-transaction
skills: [postgresql]
level: 2
format: mcq
prompt: "Moving money takes two UPDATEs, one for each account. How do you make sure both happen or neither does?"
options:
  - "Run them in one transaction, between BEGIN and COMMIT"
  - "Run them one straight after the other"
  - "Add an index on the accounts table"
  - "Run each in its own connection"
answer: 0
explanation: "A transaction is atomic: if anything fails before COMMIT, every change in it is rolled back."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
