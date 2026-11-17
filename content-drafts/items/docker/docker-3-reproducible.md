---
schema: assessment-item/1
slug: docker-3-reproducible
skills: [docker]
level: 3
format: mcq
prompt: "Builds of the same Dockerfile give different results from week to week. What makes them reproducible?"
options:
  - "Using FROM node:latest"
  - "Running apt-get upgrade during the build"
  - "Building with --no-cache every time"
  - "Pinning the base image by digest, and dependencies with a lock file"
answer: 3
explanation: "Tags and unpinned installs change under you; digests and lock files don't."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
