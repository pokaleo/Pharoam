---
schema: assessment-item/1
slug: authentication-and-authorisation-4-refresh-theft
skills: [authentication-and-authorisation]
level: 4
format: mcq
prompt: "Refresh tokens may have been stolen from one of your clients. What limits the damage most?"
options:
  - "Shortening access-token lifetimes, leaving refresh tokens unchanged"
  - "Rotating refresh tokens, revoking the whole family when a used one returns"
  - "Encrypting refresh tokens where the client stores them"
  - "Logging every refresh, and reviewing the logs weekly"
answer: 1
explanation: "With rotation, a stolen token that is used again reveals the theft and cuts off both parties."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
