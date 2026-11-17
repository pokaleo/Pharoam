---
schema: assessment-item/1
slug: secure-coding-3-csrf
skills: [secure-coding]
level: 3
format: mcq
prompt: "A site uses cookie sessions, and POST /transfer accepts form posts. What stops another site submitting it in a signed-in person's browser?"
options:
  - "HTTPS on its own"
  - "SameSite cookies, together with an anti-CSRF token checked by the server"
  - "A CAPTCHA on the sign-in page"
  - "Hiding the form's URL in JavaScript"
answer: 1
explanation: "The browser sends cookies with cross-site requests unless SameSite stops it; a token proves the form came from the site."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
