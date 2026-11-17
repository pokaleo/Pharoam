---
schema: assessment-item/1
slug: authentication-and-authorisation-2-cookie
skills: [authentication-and-authorisation]
level: 2
format: mcq
prompt: "A session ID is kept in a cookie. Which attributes should the cookie have?"
options:
  - "HttpOnly, Secure and SameSite"
  - "An expiry ten years away, and Path=/"
  - "A Domain covering every subdomain, and nothing else"
  - "None: cookies are private already"
answer: 0
explanation: "HttpOnly hides it from scripts, Secure keeps it to HTTPS, and SameSite limits cross-site sending."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
