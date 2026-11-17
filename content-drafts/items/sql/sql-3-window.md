---
schema: assessment-item/1
slug: sql-3-window
skills: [sql]
level: 3
format: mcq
prompt: "Which query ranks each employee's salary within their department, highest first, keeping every employee's row?"
options:
  - "SELECT name, dept, RANK() OVER (ORDER BY dept, salary DESC) FROM employees;"
  - "SELECT name, dept, RANK() OVER (PARTITION BY dept ORDER BY salary) FROM employees;"
  - "SELECT name, dept, RANK() OVER (PARTITION BY dept ORDER BY salary DESC) FROM employees;"
  - "SELECT name, dept, RANK() OVER (PARTITION BY salary ORDER BY dept DESC) FROM employees;"
answer: 2
explanation: "A window function with PARTITION BY ranks within each department and keeps every row; GROUP BY collapses them."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-15T01:52:45Z
---
