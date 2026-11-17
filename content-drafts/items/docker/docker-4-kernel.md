---
schema: assessment-item/1
slug: docker-4-kernel
skills: [docker]
level: 4
format: mcq
prompt: "A containerised process can't see the host's other processes and can't use more than 512 MB of RAM. Which kernel features provide these?"
options:
  - "PID namespace; memory cgroup"
  - "seccomp; ulimit"
  - "chroot; memory cgroup"
  - "PID namespace; ulimit"
answer: 0
explanation: "A PID namespace gives the container its own process tree, and the memory cgroup caps the RAM its processes use together."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
