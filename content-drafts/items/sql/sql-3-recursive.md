---
schema: assessment-item/1
slug: sql-3-recursive
skills: [sql]
level: 3
format: mcq
prompt: "WITH RECURSIVE chain AS (\n  SELECT id, manager_id FROM staff WHERE id = 7\n  UNION ALL\n  SELECT s.id, s.manager_id FROM staff s JOIN chain c ON s.id = c.manager_id\n)\nSELECT id FROM chain;\nWhat does it return?"
options:
  - "Employee 7 and every manager above them"
  - "Employee 7 and everyone below them, at any depth"
  - "Only employee 7's direct manager"
  - "Nothing: it loops forever, as chain refers to itself"
answer: 0
explanation: "Each step joins s.id to the previous row's manager_id, so it climbs the chain until a row has no manager."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-15T01:52:45Z
---
