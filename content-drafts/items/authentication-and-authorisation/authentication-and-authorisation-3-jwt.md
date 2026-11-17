---
schema: assessment-item/1
slug: authentication-and-authorisation-3-jwt
skills: [authentication-and-authorisation]
level: 3
format: mcq
prompt: "An API accepts JWT access tokens. Which check is essential?"
options:
  - "Verify the signature with the expected algorithm and key, then check issuer, audience and expiry"
  - "Verify the signature with the algorithm the token's header names, then check expiry"
  - "Check issuer, audience and expiry, and trust the signature if the token came over HTTPS"
  - "Decode the payload, and check its issuer, audience and expiry"
answer: 0
explanation: "A JWT is only trustworthy once its signature, issuer and audience are checked against what the API expects."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
