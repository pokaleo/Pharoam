---
schema: assessment-item/1
slug: docker-3-multi-stage
skills: [docker]
level: 3
format: mcq
prompt: "What does a multi-stage build achieve?"
options:
  - "Running several containers from one Dockerfile"
  - "Building images for several CPU architectures at once"
  - "Building in one stage and copying only the result into a small final image"
  - "Splitting one image into several smaller images"
answer: 2
explanation: "Compilers and build tools stay in the build stage, out of the image that ships."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
