---
schema: assessment-item/1
slug: data-modelling-3-counter
skills: [data-modelling]
level: 3
format: mcq
prompt: "A page shows each product's review count, and counting with a join on every load is too slow at scale. What is a reasonable denormalisation?"
options:
  - "Copy each product's name into every review row"
  - "Keep a review_count on products, updated with each review change"
  - "Keep an array of review IDs on each product row"
  - "Store every review as text inside its product's row"
answer: 1
explanation: "A maintained counter adds a little work to each write and turns the read into a single column."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
