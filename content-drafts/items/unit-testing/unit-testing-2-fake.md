---
schema: assessment-item/1
slug: unit-testing-2-fake
skills: [unit-testing]
level: 2
format: mcq
prompt: "A function sends email through a mail service. How do you unit test it without sending real email?"
options:
  - "Use the mail provider's sandbox, and check its inbox"
  - "Wrap the send in try/catch so failures are ignored"
  - "Pass in a fake mail service, and check what it was asked to send"
  - "Comment out the sending line while testing"
answer: 2
explanation: "Replacing the dependency with a fake keeps the test fast and lets it check the interaction."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
