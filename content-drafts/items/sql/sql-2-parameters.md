---
schema: assessment-item/1
slug: sql-2-parameters
skills: [sql]
level: 2
format: mcq
prompt: "An app builds a query from text a user typed into a search box. Which is the safe way to include that text?"
options:
  - "Wrap it in single quotes inside the SQL string"
  - "Send it as a bound parameter, apart from the SQL"
  - "Strip its spaces before adding it to the SQL string"
  - "Cap it at 50 characters before adding it to the SQL string"
answer: 1
explanation: "A bound parameter is sent apart from the SQL, so the text can't change the query; joining it in allows SQL injection."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-15T01:52:45Z
---
