---
schema: assessment-item/1
slug: postgresql-2-foreign-key
skills: [postgresql]
level: 2
format: mcq
prompt: "orders.customer_id must always refer to an existing customer. What enforces that?"
options:
  - "An index on orders.customer_id"
  - "A foreign key constraint referencing customers (id)"
  - "A NOT NULL constraint on orders.customer_id"
  - "A UNIQUE constraint on orders.customer_id"
answer: 1
explanation: "A foreign key makes the database refuse any customer_id with no matching customer."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
