---
schema: assessment-item/1
slug: data-modelling-3-counter
skills: [data-modelling]
level: 3
format: mcq
prompt: "A page shows each product's review count, and counting with a join on every load is too slow at scale. What is a reasonable denormalisation?"
options:
  - "Drop the foreign key from reviews to products"
  - "Keep a review_count on products, updated when reviews are added or removed"
  - "Store every review as text inside its product's row"
  - "Remove the index on reviews.product_id"
answer: 1
explanation: "A maintained counter trades a little write work for fast reads, keeping one source of truth for the reviews."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
