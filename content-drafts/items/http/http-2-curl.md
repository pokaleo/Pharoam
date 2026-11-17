---
schema: assessment-item/1
slug: http-2-curl
skills: [http]
level: 2
format: mcq
prompt: "Which command prints a response's status line and headers as well as its body?"
options:
  - "curl -d https://example.com"
  - "curl -o https://example.com"
  - "curl -L https://example.com"
  - "curl -i https://example.com"
answer: 3
explanation: "-i includes the response headers in the output; -d sends data, -o writes to a file, -L follows redirects."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
