---
schema: assessment-item/1
slug: http-3-preflight
skills: [http]
level: 3
format: mcq
prompt: "A page on https://app.example.com sends a JSON POST with fetch to https://api.example.com. The browser first sends an OPTIONS request. Why?"
options:
  - "It checks that the API's TLS certificate is valid"
  - "It warms the API's cache before the real request"
  - "It is a CORS preflight, asking whether the API allows this cross-origin request"
  - "fetch always sends OPTIONS before a POST, even to the same origin"
answer: 2
explanation: "A cross-origin request with a JSON content type isn't a simple request, so the browser asks permission first."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
