---
schema: assessment-item/1
slug: unit-testing-2-clock
skills: [unit-testing]
level: 2
format: mcq
prompt: "A function's output depends on today's date, and its test fails on some days. What is the fix?"
options:
  - "Run the test on weekdays only"
  - "Pass in the date or clock, or control it with a fake clock in the test"
  - "Retry the test until it passes"
  - "Delete the test"
answer: 1
explanation: "Controlling time makes the test deterministic, so it gives the same result every day."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
