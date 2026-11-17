---
schema: assessment-item/1
slug: secure-coding-2-parameters
skills: [secure-coding]
level: 2
format: mcq
prompt: "Which code is safe against SQL injection?"
options:
  - "db.query(\"SELECT * FROM users WHERE id = \" + id)"
  - "db.query(`SELECT * FROM users WHERE id = ${id}`)"
  - "db.query(\"SELECT * FROM users WHERE id = $1\", [id])"
  - "db.query(\"SELECT * FROM users WHERE id = '\" + id.replace(\"'\", \"\") + \"'\")"
answer: 2
explanation: "A parameterised query sends the value apart from the SQL, so it can never change the query."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
