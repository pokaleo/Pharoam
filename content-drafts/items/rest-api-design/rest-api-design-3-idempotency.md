---
schema: assessment-item/1
slug: rest-api-design-3-idempotency
skills: [rest-api-design]
level: 3
format: mcq
prompt: "A client's connection drops after it sends POST /payments, before the reply. How can the API make a retry safe?"
options:
  - "Ask clients to wait a minute before they retry"
  - "Refuse a payment that matches one in the last hour"
  - "Take an idempotency key and replay the first result"
  - "Reply 202 Accepted before taking the payment"
answer: 2
explanation: "With an idempotency key, a retried request is recognised and not processed twice."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
