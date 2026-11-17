---
schema: assessment-item/1
slug: unit-testing-3-injection
skills: [unit-testing]
level: 3
format: mcq
prompt: "A class opens its own database connection in its constructor, so it can't be unit tested. What design change helps most?"
options:
  - "Make the connection a global variable"
  - "Make all its methods static"
  - "Pass the connection, or an interface for it, into the constructor"
  - "Add more comments to the class"
answer: 2
explanation: "With the dependency passed in, a test can supply a fake in its place."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
