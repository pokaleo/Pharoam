---
schema: assessment-item/1
slug: docker-4-platform
skills: [docker]
level: 4
format: mcq
prompt: "Teams across a company build images in different ways. What keeps their images secure and consistent?"
options:
  - "A Dockerfile style guide that every team agrees to follow"
  - "Maintained shared base images, with scanning and signature checks enforced automatically"
  - "Docker Hub official images only, pinned by digest so they never change"
  - "Each team runs a scanner locally and fixes what it finds"
answer: 1
explanation: "A paved road of trusted bases, checked automatically, scales better than case-by-case review."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
