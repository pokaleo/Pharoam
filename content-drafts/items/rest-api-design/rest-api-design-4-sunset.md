---
schema: assessment-item/1
slug: rest-api-design-4-sunset
skills: [rest-api-design]
level: 4
format: mcq
prompt: "Many outside teams use a field that must be removed from a public API. What is the soundest approach?"
options:
  - "Remove it in the next minor release and note the change in the changelog"
  - "Mark it deprecated, announce a sunset date, track who still uses it, and remove it only after that date"
  - "Start returning null in it now, so clients notice and adapt"
  - "Keep it forever, and never change the API again"
answer: 1
explanation: "Deprecation with notice and usage tracking lets clients move before anything breaks."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
