---
schema: assessment-item/1
slug: authentication-and-authorisation-3-id-token
skills: [authentication-and-authorisation]
level: 3
format: mcq
prompt: "In OpenID Connect, what is the ID token for?"
options:
  - "Calling APIs on the person's behalf, in place of an access token"
  - "Getting a new access token when the old one expires"
  - "Telling the client who signed in, in claims the client verifies"
  - "Encrypting the session cookie"
answer: 2
explanation: "The ID token is for the client to learn about the sign-in; access tokens are for APIs."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
