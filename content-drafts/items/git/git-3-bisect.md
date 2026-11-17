---
schema: assessment-item/1
slug: git-3-bisect
skills: [git]
level: 3
format: mcq
prompt: "A bug appeared somewhere in the last 200 commits. Which tool finds the commit that introduced it fastest?"
options:
  - "git blame"
  - "git log --oneline"
  - "git bisect"
  - "git diff"
answer: 2
explanation: "bisect binary-searches the history, finding the commit in about eight steps for 200."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
