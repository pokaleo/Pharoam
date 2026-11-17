---
schema: assessment-item/1
slug: http-4-ttl
skills: [http]
level: 4
format: mcq
prompt: "A team cut their A record's TTL from 86,400 to 300 seconds at the same moment they changed its IP address. Why do some people still reach the old server for up to a day?"
options:
  - "Resolvers that cached the record keep it for the old 86,400-second TTL"
  - "The registrar must approve the new TTL first"
  - "Browsers ignore TTLs under one hour"
  - "TLS session tickets pin clients to the old server"
answer: 0
explanation: "A cached record lives for the TTL it was fetched with, so a TTL must be lowered well before a move."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
