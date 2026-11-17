---
schema: assessment-item/1
slug: git-3-reflog
skills: [git]
level: 3
format: mcq
prompt: "After a mistaken git reset --hard, a commit seems lost. How do you get it back?"
options:
  - "You can't: reset --hard deletes commits immediately"
  - "git revert HEAD"
  - "git stash pop"
  - "Find it in git reflog, then reset or create a branch at it"
answer: 3
explanation: "The reflog records where HEAD has been, and unreachable commits survive until they are garbage-collected."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
