---
schema: assessment-item/1
slug: secure-coding-2-output-encoding
skills: [secure-coding]
level: 2
format: mcq
prompt: "A page shows a username in HTML. What stops a name such as <script>...</script> from running?"
options:
  - "Refusing usernames longer than 20 characters"
  - "Storing it base64-encoded in the database"
  - "Checking that it isn't empty"
  - "Encoding it for HTML where it is shown, so the browser displays it as text"
answer: 3
explanation: "Output encoding for the context where data is used is what stops XSS."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
