---
schema: assessment-item/1
slug: authentication-and-authorisation-2-object-access
skills: [authentication-and-authorisation]
level: 2
format: mcq
prompt: "GET /invoices/1234 checks that the person is signed in, but not that the invoice is theirs. What is the flaw?"
options:
  - "None: only signed-in people can reach it"
  - "Cross-site scripting"
  - "Broken access control: anyone signed in can read any invoice by changing the ID"
  - "Weak password storage"
answer: 2
explanation: "Being signed in isn't permission; each request must check access to the object asked for."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
