---
schema: assessment-item/1
slug: data-modelling-1-column
skills: [data-modelling]
level: 1
format: mcq
prompt: "You need to record each customer's phone number, and the customers table already exists. What is the usual change?"
options:
  - "Create a new table for each customer"
  - "Keep the numbers in a text file next to the database"
  - "Add a phone column to the customers table"
  - "Add the number to the end of the name column"
answer: 2
explanation: "A new fact about each customer is a new column on the table that holds customers."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
