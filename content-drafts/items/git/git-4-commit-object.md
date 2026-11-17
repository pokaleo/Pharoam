---
schema: assessment-item/1
slug: git-4-commit-object
skills: [git]
level: 4
format: mcq
prompt: "What does a Git commit object point to?"
options:
  - "The diff from its parent commit"
  - "Copies of only the files that changed"
  - "A tree of the project's files, its parent commits, and its author, committer and message"
  - "The branch it was made on"
answer: 2
explanation: "Git stores snapshots, not diffs; branches are just names pointing at commits."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
