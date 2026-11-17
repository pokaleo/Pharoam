---
schema: assessment-item/1
slug: authentication-and-authorisation-4-key-leak
skills: [authentication-and-authorisation]
level: 4
format: mcq
prompt: "The private key that signs your access tokens has leaked. Many services verify tokens against your published JWKS, which they cache. What should you do?"
options:
  - "Publish a new key alongside the old one, and drop the old one once its tokens expire"
  - "Remove the old key from the JWKS now, sign with a new key, and make services refresh their cached keys"
  - "Keep the key, and shorten access-token lifetimes to five minutes"
  - "Keep the key, and revoke every refresh token"
answer: 1
explanation: "Anyone with the key can mint valid tokens, so trust in it must end at once; the usual overlap period would keep accepting forged tokens."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
