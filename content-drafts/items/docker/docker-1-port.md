---
schema: assessment-item/1
slug: docker-1-port
skills: [docker]
level: 1
format: mcq
prompt: "In docker run -p 8080:80 nginx, what does -p 8080:80 do?"
options:
  - "Makes the container's port 80 reachable on port 8080 of your machine"
  - "Makes the container's port 8080 reachable on port 80 of your machine"
  - "Limits the container to 80 MB of memory"
  - "Starts 80 copies of the container"
answer: 0
explanation: "The mapping is host port first, then container port."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
