---
schema: assessment-item/1
slug: python-3-generator
skills: [python]
level: 3
format: mcq
prompt: "A function cleans each line of a huge log file. Why write it with yield rather than returning a list?"
options:
  - "Lines are processed in parallel threads"
  - "Lines are made only as the caller asks, so memory stays flat"
  - "The result can be iterated over as many times as needed"
  - "The file is closed after each line is read"
answer: 1
explanation: "A generator produces values lazily, keeping memory use flat however large the file is."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
