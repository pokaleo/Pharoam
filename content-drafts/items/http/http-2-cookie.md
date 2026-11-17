---
schema: assessment-item/1
slug: http-2-cookie
skills: [http]
level: 2
format: mcq
prompt: "How does a server ask a browser to store a cookie?"
options:
  - "With a Cookie header in its response"
  - "With a Set-Cookie header in its response"
  - "By adding it to the URL's path"
  - "With an Authorization header in its response"
answer: 1
explanation: "The server sends Set-Cookie; the browser then sends the cookie back in a Cookie header on later requests."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
