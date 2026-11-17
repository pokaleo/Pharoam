---
schema: assessment-item/1
slug: http-1-query
skills: [http]
level: 1
format: mcq
prompt: "In https://example.com/search?q=cats, what is q=cats?"
options:
  - "The query string: a parameter passed to the server"
  - "The domain name"
  - "The protocol"
  - "A cookie stored by the browser"
answer: 0
explanation: "Everything after the ? is the query string, made of name=value parameters."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
