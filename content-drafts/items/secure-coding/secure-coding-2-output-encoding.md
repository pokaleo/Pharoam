---
schema: assessment-item/1
slug: secure-coding-2-output-encoding
skills: [secure-coding]
level: 2
format: mcq
prompt: "A page shows a username in HTML. What reliably stops a name such as <script>...</script> from running as code?"
options:
  - "Removing \"<script>\" from the name when it is saved"
  - "Escaping it for SQL before it is saved"
  - "Setting HttpOnly on the session cookie"
  - "HTML-encoding it where it is shown on the page"
answer: 3
explanation: "Output encoding for the context where data is used is what stops XSS."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
