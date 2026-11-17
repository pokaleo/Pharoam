---
schema: assessment-item/1
slug: python-3-with
skills: [python]
level: 3
format: mcq
prompt: "@contextmanager\ndef opened(path):\n    f = open(path)\n    yield f\n    f.close()\n\nIf the with block using opened() raises, does f.close() run?"
options:
  - "Yes: with always runs the code after yield"
  - "No: the exception is raised at the yield, so the lines after it are skipped"
  - "Yes: contextmanager catches the exception and resumes the function"
  - "No: a generator can't act as a context manager"
answer: 1
explanation: "The exception is thrown into the generator at yield, so cleanup needs try/finally."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
