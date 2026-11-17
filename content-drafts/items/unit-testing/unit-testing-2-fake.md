---
schema: assessment-item/1
slug: unit-testing-2-fake
skills: [unit-testing]
level: 2
format: mcq
prompt: "A function sends email through a mail service. How do you unit test it without sending real email?"
options:
  - "Send real emails to a test inbox and check it by hand"
  - "Skip testing it, as it has side effects"
  - "Pass it a fake or mock mail service, and check what was sent to that"
  - "Comment out the sending line while testing"
answer: 2
explanation: "Replacing the dependency with a fake keeps the test fast and lets it check the interaction."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
