---
schema: assessment-item/1
slug: docker-4-exit-137
skills: [docker]
level: 4
format: mcq
prompt: "A container exits with code 137 under load. What is the most likely cause?"
options:
  - "It received SIGTERM and shut down cleanly"
  - "It hit an invalid memory address and got SIGSEGV"
  - "It hit its open-file limit and called abort()"
  - "It was sent SIGKILL on reaching its cgroup memory limit"
answer: 3
explanation: "137 is 128 + 9 (SIGKILL), which the OOM killer sends at the memory limit, whereas SIGTERM gives 143, SIGSEGV 139 and SIGABRT 134."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
