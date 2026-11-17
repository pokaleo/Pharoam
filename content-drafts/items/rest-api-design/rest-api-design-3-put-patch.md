---
schema: assessment-item/1
slug: rest-api-design-3-put-patch
skills: [rest-api-design]
level: 3
format: mcq
prompt: "What is the difference between PUT and PATCH on /users/42?"
options:
  - "PUT creates the resource and PATCH deletes it"
  - "PATCH is idempotent and PUT isn't"
  - "None: PATCH is an older name for PUT"
  - "PUT replaces the whole resource with the body sent; PATCH applies a partial change"
answer: 3
explanation: "PUT sends the full new state and is idempotent; PATCH sends only the changes."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
