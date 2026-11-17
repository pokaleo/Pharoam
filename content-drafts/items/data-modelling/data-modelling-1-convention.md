---
schema: assessment-item/1
slug: data-modelling-1-convention
skills: [data-modelling]
level: 1
format: mcq
prompt: "The schema's tables are plural, with snake_case columns, such as order_items.unit_price. What do you call a new table of shipping addresses?"
options:
  - "ShippingAddress"
  - "tblShipAddr"
  - "shipping_addresses"
  - "shipping-address"
answer: 2
explanation: "A new table follows the conventions already in the schema, so it reads like the rest."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
