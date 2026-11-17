---
schema: assessment-item/1
slug: secure-coding-3-csrf
skills: [secure-coding]
level: 3
format: mcq
prompt: "A site uses cookie sessions, and POST /transfer accepts form posts. What stops another site submitting it in a signed-in person's browser?"
options:
  - "A CORS policy that allows only the site's own origin"
  - "SameSite cookies, plus an anti-CSRF token the server checks"
  - "Accepting only POST, never GET, for the transfer"
  - "Checking the Referer header whenever one is sent"
answer: 1
explanation: "The browser sends cookies with cross-site requests unless SameSite stops it; a token proves the form came from the site."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
