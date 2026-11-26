---
schema: assessment-item/1
slug: docker-1-run
skills: [docker]
level: 1
format: mcq
prompt: "Which command starts a container from the nginx image?"
options:
  - "docker run nginx"
  - "docker build nginx"
  - "docker push nginx"
  - "docker image nginx"
answer: 0
explanation: "run creates and starts a container from an image, downloading the image if needed."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
