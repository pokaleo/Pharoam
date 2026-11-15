---
schema: assessment-item/1
slug: sql-4-not-in-null
skills: [sql]
level: 4
format: mcq
prompt: "SELECT * FROM a WHERE id NOT IN (SELECT a_id FROM b); returns no rows, although many rows of a have no match in b. What is the most likely cause?"
options:
  - "NOT IN only works on indexed columns"
  - "b.a_id contains a NULL, so every NOT IN comparison is unknown, not true"
  - "The subquery runs once per row and times out silently"
  - "NOT IN compares text case-sensitively"
answer: 1
explanation: "x NOT IN (…, NULL) is never true, since comparing with NULL is unknown; NOT EXISTS avoids this."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-15T01:52:45Z
---
