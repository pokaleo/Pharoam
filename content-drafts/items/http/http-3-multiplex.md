---
schema: assessment-item/1
slug: http-3-multiplex
skills: [http]
level: 3
format: mcq
prompt: "What is HTTP/2's main gain over HTTP/1.1 for a page that loads many small files?"
options:
  - "It sends requests over UDP instead of TCP"
  - "It drops headers to save space"
  - "Many requests share one connection at the same time, so they don't wait in line"
  - "It no longer needs TLS, so connections start faster"
answer: 2
explanation: "HTTP/2 multiplexes streams over one TCP connection; UDP (through QUIC) is HTTP/3."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
