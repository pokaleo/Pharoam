---
schema: assessment-item/1
slug: sql-4-estimates
skills: [sql]
level: 4
format: mcq
prompt: "A nested loop join expected 10 rows from its outer side but got 2 million, so its inner index scan ran 2 million times. What should be investigated first?"
options:
  - "The statistics behind the outer side's row estimate"
  - "Whether work_mem is too small, so the join spills to disk"
  - "Whether the inner index is bloated and needs rebuilding"
  - "Whether the query needs more parallel workers"
answer: 0
explanation: "The planner picked a nested loop because it expected few outer rows, so a misestimate this large points to statistics that no longer describe the data."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-15T01:52:45Z
---
