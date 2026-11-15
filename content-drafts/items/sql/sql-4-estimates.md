---
schema: assessment-item/1
slug: sql-4-estimates
skills: [sql]
level: 4
format: mcq
prompt: "A plan shows a nested loop join whose inner side runs an index scan 2 million times, where the planner estimated 10 rows. What should be investigated first?"
options:
  - "Stale or missing statistics leading the planner to underestimate the outer rows"
  - "The index being too small to hold the data"
  - "Too many columns in the SELECT list"
  - "Whether the server needs restarting"
answer: 0
explanation: "A nested loop suits few outer rows; a huge misestimate usually means the statistics no longer describe the data."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-15T01:52:45Z
---
