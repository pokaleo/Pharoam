---
schema: assessment-item/1
slug: authentication-and-authorisation-4-key-leak
skills: [authentication-and-authorisation]
level: 4
format: mcq
prompt: "The key that signs your session tokens has leaked. What do you do first?"
options:
  - "Rotate the key, so tokens signed with the old one stop being accepted, ending existing sessions"
  - "Wait for existing tokens to expire on their own"
  - "Ask everyone to change their password, and keep the key"
  - "Add rate limiting to the sign-in endpoint"
answer: 0
explanation: "Anyone with the key can mint valid tokens, so it must stop being trusted at once."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
