---
schema: assessment-item/1
slug: git-2-conflict
skills: [git]
level: 2
format: mcq
prompt: "A merge stops with a conflict in app.py. What do you do?"
options:
  - "Edit app.py to remove the markers, git add it, then git commit"
  - "Run git commit straight away; Git keeps both versions in the file"
  - "Run git merge --continue, then fix app.py afterwards"
  - "Run git checkout app.py to clear the conflict, then commit"
answer: 0
explanation: "Git marks both versions in the file; you choose the result, stage it, and finish the merge."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
