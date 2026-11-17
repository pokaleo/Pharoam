---
schema: assessment-item/1
slug: authentication-and-authorisation-1-protected
skills: [authentication-and-authorisation]
level: 1
format: mcq
prompt: "A page is protected with the framework's \"sign-in required\" check. What happens when someone who isn't signed in opens it?"
options:
  - "They see the page with its data hidden by CSS"
  - "They see the page anyway"
  - "They are sent to sign in, or refused"
  - "The server stops"
answer: 2
explanation: "The check runs on the server before the page is built, so nothing protected is sent."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
