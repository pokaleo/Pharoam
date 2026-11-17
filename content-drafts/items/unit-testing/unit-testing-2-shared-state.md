---
schema: assessment-item/1
slug: unit-testing-2-shared-state
skills: [unit-testing]
level: 2
format: mcq
prompt: "Tests pass when run one at a time but fail when run together. What is the most likely cause?"
options:
  - "They share state that one test changes and another relies on"
  - "The runner caches results from an earlier run"
  - "The tests use too many mocks"
  - "The assertions are too strict"
answer: 0
explanation: "Independent tests set up their own state and leave nothing behind for others."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
