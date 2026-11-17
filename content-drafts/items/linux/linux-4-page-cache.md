---
schema: assessment-item/1
slug: linux-4-page-cache
skills: [linux]
level: 4
format: mcq
prompt: "To \"free memory\", an engineer runs echo 3 > /proc/sys/vm/drop_caches nightly on a busy file server. What is the effect?"
options:
  - "Reads go to disk until the cache warms again, slowing the server"
  - "Memory leaked by programs is returned to the system"
  - "Dirty pages are written to disk, protecting data from a crash"
  - "The server stops swapping because programs get more memory"
answer: 0
explanation: "drop_caches discards only clean cache that the kernel would reclaim anyway, so it just forces later reads back to disk."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
