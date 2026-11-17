---
schema: assessment-item/1
slug: unit-testing-3-behaviour
skills: [unit-testing]
level: 3
format: mcq
prompt: "Which is the least brittle test for a function that sorts orders by date?"
options:
  - "One that mocks the comparison helper and checks it ran for each pair"
  - "One that checks the dates in the result for a small, fixed list of orders"
  - "One that compares the full output, every field included, with a stored snapshot"
  - "One that checks the function calls Array.prototype.sort exactly once"
answer: 1
explanation: "Tests of observable behaviour survive refactoring; tests of internals break when the code is improved."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
