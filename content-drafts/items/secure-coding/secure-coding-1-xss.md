---
schema: assessment-item/1
slug: secure-coding-1-xss
skills: [secure-coding]
level: 1
format: mcq
prompt: "An attacker posts a comment that makes code run in other visitors' browsers. What is this called?"
options:
  - "SQL injection"
  - "Cross-site request forgery (CSRF)"
  - "Cross-site scripting (XSS)"
  - "Brute force"
answer: 2
explanation: "XSS happens when a page includes untrusted input as code rather than as text."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
