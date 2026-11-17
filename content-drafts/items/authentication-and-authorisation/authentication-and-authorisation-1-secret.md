---
schema: assessment-item/1
slug: authentication-and-authorisation-1-secret
skills: [authentication-and-authorisation]
level: 1
format: mcq
prompt: "A sign-in example uses a client secret from the provider. Where should your real secret go?"
options:
  - "In the source file, so it's easy to find"
  - "In the README"
  - "In the JavaScript sent to the browser"
  - "In an environment variable or a secret store"
answer: 3
explanation: "Secrets in code end up in version control and in builds, where others can read them."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
