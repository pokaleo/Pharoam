---
schema: assessment-item/1
slug: python-4-gil
skills: [python]
level: 4
format: mcq
prompt: "A CPU-bound task gets no faster when split across threads in CPython. What is the usual reason, and the usual fix?"
options:
  - "Threads in Python are always slower; rewrite in a single loop"
  - "The operating system limits Python to one core; raise its priority"
  - "The task needs more memory; add RAM"
  - "The global interpreter lock lets one thread run Python bytecode at a time; use processes, such as multiprocessing"
answer: 3
explanation: "In CPython the GIL serialises bytecode, so CPU-bound work scales with processes, not threads."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
