---
schema: assessment-item/1
slug: data-modelling-2-natural-key
skills: [data-modelling]
level: 2
format: mcq
prompt: "Should a users table use the email address as its primary key?"
options:
  - "Yes: emails are unique, so they make a good natural key"
  - "Yes, but only if email also has its own index"
  - "No: primary keys have to be whole numbers"
  - "No: emails change; use a surrogate key and keep email unique"
answer: 3
explanation: "Other tables refer to the primary key, so it should never need to change."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
