---
schema: assessment-item/1
slug: git-2-branch
skills: [git]
level: 2
format: mcq
prompt: "Which command creates a branch named feature and switches to it?"
options:
  - "git branch -d feature"
  - "git switch -c feature"
  - "git merge feature"
  - "git tag feature"
answer: 1
explanation: "switch -c creates the branch and moves to it; branch -d deletes one."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
