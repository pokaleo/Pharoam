---
schema: assessment-item/1
slug: http-1-query
skills: [http]
level: 1
format: mcq
prompt: "In https://example.com/search?q=cats, what is q=cats?"
options:
  - "The query string, sent to the server with the request"
  - "The fragment, which the browser keeps to itself"
  - "Part of the path, naming a file on the server"
  - "The request body, sent apart from the URL"
answer: 0
explanation: "Everything after the ? is the query string, made of name=value parameters."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
