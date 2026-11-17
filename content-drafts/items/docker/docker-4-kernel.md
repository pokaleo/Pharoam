---
schema: assessment-item/1
slug: docker-4-kernel
skills: [docker]
level: 4
format: mcq
prompt: "Which Linux kernel features isolate containers and limit their resources?"
options:
  - "Namespaces for isolation, and cgroups for resource limits"
  - "A hypervisor running a virtual machine per container"
  - "chroot on its own"
  - "A separate kernel for each container"
answer: 0
explanation: "Containers share the host kernel; namespaces separate what they see, and cgroups cap what they use."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
