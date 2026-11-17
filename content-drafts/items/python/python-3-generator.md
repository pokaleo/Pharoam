---
schema: assessment-item/1
slug: python-3-generator
skills: [python]
level: 3
format: mcq
prompt: "Why use a generator to process a very large file line by line?"
options:
  - "It makes each line's processing run in parallel"
  - "It yields one line at a time, so the whole file is never held in memory"
  - "It sorts the lines first"
  - "It caches the file for next time"
answer: 1
explanation: "A generator produces values lazily, keeping memory use flat however large the file is."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
