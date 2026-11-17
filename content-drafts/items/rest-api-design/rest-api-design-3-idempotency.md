---
schema: assessment-item/1
slug: rest-api-design-3-idempotency
skills: [rest-api-design]
level: 3
format: mcq
prompt: "A client's connection drops after it sends POST /payments, before the reply. How can the API make a retry safe?"
options:
  - "Ask clients to wait a minute before retrying"
  - "Make the endpoint a GET, so retries do no harm"
  - "Accept an idempotency key, and return the first result when the same key is sent again"
  - "Refuse a second payment from the same client within an hour"
answer: 2
explanation: "With an idempotency key, a retried request is recognised and not processed twice."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
