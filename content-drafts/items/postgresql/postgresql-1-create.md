---
schema: assessment-item/1
slug: postgresql-1-create
skills: [postgresql]
level: 1
format: mcq
prompt: "Which statement defines a new users table with two columns?"
options:
  - "INSERT INTO users (id integer, name text);"
  - "ALTER TABLE users ADD (id integer, name text);"
  - "CREATE TABLE users (id integer, name text);"
  - "CREATE users TABLE (id integer, name text);"
answer: 2
explanation: "CREATE TABLE defines a new table with its columns and their types."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
