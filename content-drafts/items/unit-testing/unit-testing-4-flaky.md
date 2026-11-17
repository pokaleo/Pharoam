---
schema: assessment-item/1
slug: unit-testing-4-flaky
skills: [unit-testing]
level: 4
format: mcq
prompt: "Across a large codebase, flaky tests fail a few runs in every hundred. What policy works best?"
options:
  - "Retry every failing test until it passes"
  - "Ignore failures that don't happen twice"
  - "Turn off CI until they are all fixed"
  - "Track them, take them out of the blocking run with an owner and a deadline, and fix their cause"
answer: 3
explanation: "Quarantining with ownership keeps the main signal trustworthy without hiding the problem."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
