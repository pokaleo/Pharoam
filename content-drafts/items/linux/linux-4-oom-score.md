---
schema: assessment-item/1
slug: linux-4-oom-score
skills: [linux]
level: 4
format: mcq
prompt: "By default, which process does the kernel's out-of-memory killer end?"
options:
  - "The process that most recently asked for memory"
  - "The process that has used the most CPU time"
  - "The process with the highest nice value"
  - "The process with the highest oom_score, based on its memory and oom_score_adj"
answer: 3
explanation: "Since Linux 2.6.36 the score is mostly resident memory, swap and page tables, shifted by oom_score_adj; CPU time and nice no longer count."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
