---
schema: assessment-item/1
slug: unit-testing-2-clock
skills: [unit-testing]
level: 2
format: mcq
prompt: "A function's output depends on today's date, and its test fails on some days. What is the best fix?"
options:
  - "Work out the expected value in the test from today's date, as the function does"
  - "Pass a date or clock into the function, and fix it in the test"
  - "Mock the function itself so it returns a fixed result"
  - "Set the CI server's time zone to UTC"
answer: 1
explanation: "Controlling time makes the test deterministic, so it gives the same result every day."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
