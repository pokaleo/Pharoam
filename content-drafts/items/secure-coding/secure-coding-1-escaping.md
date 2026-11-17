---
schema: assessment-item/1
slug: secure-coding-1-escaping
skills: [secure-coding]
level: 1
format: mcq
prompt: "Your web framework escapes HTML in templates by default. What should you do?"
options:
  - "Turn it off, so you can include HTML anywhere"
  - "Keep the default, and avoid features that turn escaping off"
  - "Escape everything a second time yourself"
  - "Nothing: escaping only matters for forms"
answer: 1
explanation: "Safe defaults prevent XSS; the risk comes from switching them off."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
