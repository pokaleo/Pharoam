---
schema: assessment-item/1
slug: unit-testing-4-pyramid
skills: [unit-testing]
level: 4
format: mcq
prompt: "A team has thousands of slow, often-broken end-to-end tests and few unit tests. What shift does the testing pyramid suggest?"
options:
  - "Push most checks down to unit and integration tests, keeping a few end-to-end journeys"
  - "Add more end-to-end tests to catch what the others miss"
  - "Run them in parallel on more machines"
  - "Keep them all, and retry failures automatically"
answer: 0
explanation: "Many fast, focused tests at the base and few broad ones at the top give quick, reliable feedback."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
