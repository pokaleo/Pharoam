---
schema: assessment-item/1
slug: http-3-etag
skills: [http]
level: 3
format: mcq
prompt: "A client sends If-None-Match with the ETag it holds, and the resource hasn't changed. What should the server reply?"
options:
  - "304 Not Modified, with no body"
  - "200 OK, with the full body again"
  - "204 No Content"
  - "412 Precondition Failed"
answer: 0
explanation: "304 tells the client its cached copy is still good, saving the body's transfer."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
