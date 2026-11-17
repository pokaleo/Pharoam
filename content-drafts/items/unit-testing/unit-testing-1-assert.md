---
schema: assessment-item/1
slug: unit-testing-1-assert
skills: [unit-testing]
level: 1
format: mcq
prompt: "A test of add(2, 3) should check its result. Which line does that?"
options:
  - "add(2, 3)"
  - "expect(add(2, 3)).toBe(5)"
  - "console.log(add(2, 3))"
  - "expect(add).toBe(5)"
answer: 1
explanation: "An assertion compares the actual result with the expected one, failing the test if they differ."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
