---
schema: assessment-item/1
slug: unit-testing-3-behaviour
skills: [unit-testing]
level: 3
format: mcq
prompt: "Which is the least brittle test for a function that sorts orders by date?"
options:
  - "One that checks which sort algorithm the function calls internally"
  - "One that checks the order in which the orders come back"
  - "One that checks how many times a private helper ran"
  - "One that compares a snapshot of the function's source code"
answer: 1
explanation: "Tests of observable behaviour survive refactoring; tests of internals break when the code is improved."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
