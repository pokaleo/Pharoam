---
schema: assessment-item/1
slug: python-3-with
skills: [python]
level: 3
format: mcq
prompt: "What does a with statement guarantee when used with open()?"
options:
  - "The file is read into memory at once"
  - "Only one program can open the file"
  - "The file is closed when the block ends, even if an exception is raised"
  - "The file is created if it doesn't exist"
answer: 2
explanation: "The context manager's exit runs however the block ends, so the file is always closed."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
