---
schema: assessment-item/1
slug: git-4-trunk
skills: [git]
level: 4
format: mcq
prompt: "A team releases continuously from main and wants short-lived branches. Which workflow fits?"
options:
  - "Trunk-based development: small branches merged often, with unfinished work behind feature flags"
  - "Git flow, with long-lived develop and release branches"
  - "One long-lived branch per developer, merged monthly"
  - "Committing straight to release tags"
answer: 0
explanation: "Merging small changes often keeps main releasable and avoids long-lived divergence."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
