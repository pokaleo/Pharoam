---
schema: assessment-item/1
slug: unit-testing-4-flaky
skills: [unit-testing]
level: 4
format: mcq
prompt: "Across a large codebase, flaky tests fail a few runs in every hundred. What policy works best?"
options:
  - "Retry failing tests up to three times, and treat any pass as a pass"
  - "Delete any test that has flaked more than once"
  - "Quarantine them indefinitely, reviewing the list yearly"
  - "Quarantine them from the blocking run, each with an owner and a fix deadline"
answer: 3
explanation: "Quarantining with ownership keeps the main signal trustworthy without hiding the problem."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
