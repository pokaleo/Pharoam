---
schema: assessment-item/1
slug: docker-4-platform
skills: [docker]
level: 4
format: mcq
prompt: "Teams across a company build images in different ways. What keeps their images secure and consistent?"
options:
  - "Letting each team pick any public image"
  - "Shared, maintained base images, with scanning and signing enforced in CI and at deployment"
  - "One large image that every service uses"
  - "A manual review of each image once a year"
answer: 1
explanation: "A paved road of trusted bases, checked automatically, scales better than case-by-case review."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
