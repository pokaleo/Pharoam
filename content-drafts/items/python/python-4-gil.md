---
schema: assessment-item/1
slug: python-4-gil
skills: [python]
level: 4
format: mcq
prompt: "A CPU-bound task gets no faster when split across threads in standard (GIL) CPython. What is the reason, and the usual fix?"
options:
  - "Python threads share one OS thread; use asyncio"
  - "The GIL runs one thread's bytecode at a time; use asyncio tasks"
  - "The GIL runs one thread's bytecode at a time; use a process pool"
  - "Thread start-up costs outweigh the work; use a thread pool"
answer: 2
explanation: "With the GIL only one thread runs Python bytecode at a time, so CPU-bound work scales with processes; the free-threaded build is the exception."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
