---
schema: assessment-item/1
slug: python-2-venv
skills: [python]
level: 2
format: mcq
prompt: "Why use a virtual environment (venv) for a project?"
options:
  - "To make the code run faster"
  - "To sandbox the code away from the rest of the disk"
  - "To keep the project's packages apart from other projects'"
  - "To bundle the project and Python into one file"
answer: 2
explanation: "Each virtual environment has its own installed packages, so projects needing different versions don't clash."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
