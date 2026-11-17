---
schema: assessment-item/1
slug: docker-2-compose-dns
skills: [docker]
level: 2
format: mcq
prompt: "In Docker Compose, how does the api service reach the db service?"
options:
  - "Through localhost:5432"
  - "By the db container's IP address, written into the config"
  - "By the service name, such as db:5432, on the network Compose creates"
  - "It can't: services need published ports to talk to each other"
answer: 2
explanation: "Compose puts services on a shared network where each is reachable by its name."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
