---
schema: assessment-item/1
slug: linux-4-page-cache
skills: [linux]
level: 4
format: mcq
prompt: "free shows almost no free memory on a busy file server, yet nothing swaps or slows down. Why?"
options:
  - "The kernel is leaking memory"
  - "free counts swap as used memory"
  - "The kernel uses spare memory as page cache, and gives it back when programs need it"
  - "The disks are full"
answer: 2
explanation: "Unused memory is wasted memory; the \"available\" column is the one that matters."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
