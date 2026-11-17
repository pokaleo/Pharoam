---
schema: assessment-item/1
slug: docker-3-non-root
skills: [docker]
level: 3
format: mcq
prompt: "Which change most improves an image's security?"
options:
  - "Adding curl and vim for debugging"
  - "Using the latest tag for the base image"
  - "Running the app as a non-root user, set with USER"
  - "Exposing more ports"
answer: 2
explanation: "If the app is compromised, a non-root user limits what the attacker can do."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
