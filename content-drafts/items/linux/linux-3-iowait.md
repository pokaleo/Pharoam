---
schema: assessment-item/1
slug: linux-3-iowait
skills: [linux]
level: 3
format: mcq
prompt: "A 4-core server has a load average of 16, but its CPU use is low. What should you look at next?"
options:
  - "Adding more CPU cores"
  - "How many people are signed in"
  - "The server's hostname settings"
  - "Processes waiting on disk or network I/O, with tools such as vmstat or iostat"
answer: 3
explanation: "Load counts processes waiting to run and those stuck in uninterruptible I/O; low CPU points to I/O."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
