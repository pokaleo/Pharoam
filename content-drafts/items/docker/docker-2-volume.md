---
schema: assessment-item/1
slug: docker-2-volume
skills: [docker]
level: 2
format: mcq
prompt: "A database runs in a container. How do you keep its data when the container is removed?"
options:
  - "Commit the container to a new image after every change"
  - "Keep the data in a volume"
  - "Give the container more memory"
  - "Start it with --restart always"
answer: 1
explanation: "A container's own file system goes with it; volumes live on independently."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
