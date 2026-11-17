---
schema: assessment-item/1
slug: http-2-no-store
skills: [http]
level: 2
format: mcq
prompt: "A response has the header Cache-Control: no-store. What does it tell caches?"
options:
  - "To keep a copy but check with the server before each reuse"
  - "To keep a copy for one day"
  - "To keep a copy in the browser only, not in shared caches"
  - "Not to keep a copy of the response at all"
answer: 3
explanation: "no-store forbids storing; no-cache allows storing but requires revalidation; private limits it to the browser."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
