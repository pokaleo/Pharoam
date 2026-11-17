---
schema: assessment-item/1
slug: python-2-except
skills: [python]
level: 2
format: mcq
prompt: "A program reads a number from text that may not be a number. Which handles that safely?"
options:
  - "n = int(text) or 0"
  - "try:\n    n = int(text)\nexcept ValueError:\n    n = 0"
  - "if int(text):\n    n = int(text)"
  - "n = int(text, default=0)"
answer: 1
explanation: "int() raises ValueError for text that isn't a number; catching it lets the program carry on."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
