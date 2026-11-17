---
schema: assessment-item/1
slug: linux-3-iowait
skills: [linux]
level: 3
format: mcq
prompt: "A 4-core server has a load average of 16, but top shows the CPUs mostly idle. What is the most likely explanation?"
options:
  - "A process is stuck in an infinite loop"
  - "Many processes are blocked on disk I/O, which Linux counts in load"
  - "Load average counts every sleeping process, so 16 is normal"
  - "The server needs more cores to bring the load down"
answer: 1
explanation: "Linux load includes tasks in uninterruptible sleep, usually waiting on disk or NFS, so high load with idle CPUs points to I/O."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
