---
schema: assessment-item/1
slug: docker-4-exit-137
skills: [docker]
level: 4
format: mcq
prompt: "A container exits with code 137 under load. What is the most likely cause?"
options:
  - "The app returned an error from its main function"
  - "The image is corrupt"
  - "It was killed with SIGKILL, often by the out-of-memory killer at its memory limit"
  - "A port was already in use"
answer: 2
explanation: "137 is 128 + 9, the signal number of SIGKILL; check for OOMKilled in docker inspect."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
