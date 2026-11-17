---
schema: assessment-item/1
slug: http-4-vary
skills: [http]
level: 4
format: mcq
prompt: "A CDN serves a gzip-compressed page to a client that didn't ask for compression. Which header was the origin's response most likely missing?"
options:
  - "Vary: Accept-Encoding"
  - "Content-Encoding: identity"
  - "Cache-Control: public"
  - "Transfer-Encoding: chunked"
answer: 0
explanation: "Vary tells caches to keep a separate copy for each Accept-Encoding, so the compressed copy goes only to clients that asked for it."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
