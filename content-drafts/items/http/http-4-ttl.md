---
schema: assessment-item/1
slug: http-4-ttl
skills: [http]
level: 4
format: mcq
prompt: "A site moves to a new IP address, but some people keep reaching the old server for hours. What is the most likely cause?"
options:
  - "Browsers are serving the old pages from their HTTP cache"
  - "The new server's TLS certificate hasn't reached every browser yet"
  - "DNS resolvers are still serving the old record until its TTL runs out"
  - "TCP connections stay pinned to an IP address for a day"
answer: 2
explanation: "Resolvers cache records for their TTL; lowering it before a move shortens the change-over."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
