---
schema: assessment-item/1
slug: data-modelling-2-many-to-many
skills: [data-modelling]
level: 2
format: mcq
prompt: "Students take many courses, and each course has many students. How is that usually modelled?"
options:
  - "A join table, such as enrolments, with a foreign key to each"
  - "A course_ids column on students, holding a comma-separated list"
  - "A student_id column on courses"
  - "One table holding both students and courses"
answer: 0
explanation: "A many-to-many relationship needs a table of its own, with a row for each pairing."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
