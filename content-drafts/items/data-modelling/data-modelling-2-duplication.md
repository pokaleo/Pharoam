---
schema: assessment-item/1
slug: data-modelling-2-duplication
skills: [data-modelling]
level: 2
format: mcq
prompt: "Every order row repeats the customer's current name and address. What problem does that cause?"
options:
  - "Orders can no longer be joined to customers"
  - "The database refuses repeated text"
  - "When a customer's details change, every order row must be updated, or they disagree"
  - "None: repeating data always makes queries faster"
answer: 2
explanation: "Facts stored in more than one place can drift apart; normalising keeps each fact in one place."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
