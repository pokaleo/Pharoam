---
schema: assessment-item/1
slug: git-4-purge
skills: [git]
level: 4
format: mcq
prompt: "A large file and a secret were committed months ago in a shared repository. What does removing them properly involve?"
options:
  - "Rewriting history with a tool such as git filter-repo, force-pushing, having everyone re-clone, and rotating the secret"
  - "Deleting them in a new commit"
  - "Running git gc"
  - "Adding them to .gitignore"
answer: 0
explanation: "Every clone holds the old commits, so history must be rewritten everywhere, and the secret treated as leaked."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
