---
schema: assessment-item/1
slug: secure-coding-3-ssrf
skills: [secure-coding]
level: 3
format: mcq
prompt: "An endpoint fetches any URL a user gives it, to build a link preview. What is the main risk?"
options:
  - "Cross-site request forgery against the user's browser"
  - "Server-side request forgery: requests to internal services or cloud metadata from inside your network"
  - "SQL injection through the URL"
  - "Slow pages for people who send long URLs"
answer: 1
explanation: "The server can reach places the attacker can't; allow-list destinations and block internal addresses."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
