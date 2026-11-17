---
schema: assessment-item/1
slug: data-modelling-3-price-paid
skills: [data-modelling]
level: 3
format: mcq
prompt: "Order lines must show the price paid, even after a product's price changes. How do you model that?"
options:
  - "Look up the product's current price whenever the order is shown"
  - "Never change a product's price once it has been sold"
  - "Copy the unit price onto each order line when the order is placed"
  - "Have the order line refer to the product's price column"
answer: 2
explanation: "The price paid is a fact about the order at that time, not a copy of the product's current price."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
