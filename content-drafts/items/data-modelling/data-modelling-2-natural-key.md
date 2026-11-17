---
schema: assessment-item/1
slug: data-modelling-2-natural-key
skills: [data-modelling]
level: 2
format: mcq
prompt: "Should a users table use the email address as its primary key?"
options:
  - "Yes: emails are unique, so they make the best primary key"
  - "Yes, as long as the email column is also indexed"
  - "No, because primary keys must be numbers"
  - "Usually not: emails change, so a stable surrogate key with a unique constraint on email is safer"
answer: 3
explanation: "Other tables refer to the primary key, so it should never need to change."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
