---
schema: assessment-item/1
slug: docker-2-layer-cache
skills: [docker]
level: 2
format: mcq
prompt: "Why copy package.json and install dependencies before copying the rest of the source in a Dockerfile?"
options:
  - "Docker requires package.json to come first"
  - "So the install step stays cached when only source files change"
  - "It makes the container run faster"
  - "So the source code is left out of the image"
answer: 1
explanation: "Each instruction is a cached layer, rebuilt only when its inputs change."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
