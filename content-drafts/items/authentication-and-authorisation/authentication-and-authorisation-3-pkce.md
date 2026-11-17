---
schema: assessment-item/1
slug: authentication-and-authorisation-3-pkce
skills: [authentication-and-authorisation]
level: 3
format: mcq
prompt: "A single-page or mobile app uses OAuth 2.0 to get tokens. Which flow fits?"
options:
  - "The implicit flow"
  - "The resource owner password credentials flow"
  - "The client credentials flow"
  - "The authorization code flow with PKCE"
answer: 3
explanation: "Public clients can't keep a secret; PKCE protects the code exchange, and the implicit flow is no longer recommended."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
