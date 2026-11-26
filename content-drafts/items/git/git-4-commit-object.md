---
schema: assessment-item/1
slug: git-4-commit-object
skills: [git]
level: 4
format: mcq
prompt: "What does a Git commit object store?"
options:
  - "A diff against its parent, with author and message"
  - "Copies of the changed files, with author and message"
  - "A pointer to a tree of the whole project, its parents, author and message"
  - "The name of its branch, with author and message"
answer: 2
explanation: "A commit records a full-project tree plus parents and metadata; deltas exist only as packfile compression, and branches are separate refs."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
