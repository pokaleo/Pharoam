---
schema: assessment-item/1
slug: unit-testing-4-mutation
skills: [unit-testing]
level: 4
format: mcq
prompt: "Coverage is 95%, yet bugs keep slipping through. Which technique tests the tests themselves?"
options:
  - "Raising the coverage target to 100%"
  - "Property-based testing"
  - "Measuring branch coverage instead of line coverage"
  - "Mutation testing"
answer: 3
explanation: "Coverage shows code was run, not that its result was checked; surviving mutants show weak assertions."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
