---
schema: assessment-item/1
slug: http-4-quic
skills: [http]
level: 4
format: mcq
prompt: "HTTP/3 runs over QUIC, on UDP. Which problem of HTTP/2 over TCP does that address?"
options:
  - "Responses no longer need to be encrypted"
  - "One lost packet no longer stalls every stream on the connection"
  - "Servers can now push responses the client didn't ask for"
  - "Headers no longer need to be compressed"
answer: 1
explanation: "TCP delivers in order, so a loss blocks all HTTP/2 streams; QUIC recovers each stream separately."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
