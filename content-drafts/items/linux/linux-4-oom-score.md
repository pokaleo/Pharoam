---
schema: assessment-item/1
slug: linux-4-oom-score
skills: [linux]
level: 4
format: mcq
prompt: "What decides which process the kernel's out-of-memory killer ends?"
options:
  - "Whichever process started most recently"
  - "The process with the lowest PID"
  - "Each process's oom_score, based mainly on its memory use and adjusted by oom_score_adj"
  - "A random choice"
answer: 2
explanation: "The kernel picks the process whose death frees the most memory, weighted by oom_score_adj."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
