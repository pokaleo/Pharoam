---
schema: assessment-item/1
slug: git-3-fixup
skills: [git]
level: 3
format: mcq
prompt: "Before opening a PR, you want to fold three \"fix typo\" commits into the commit they fix. What do you use?"
options:
  - "git merge --squash"
  - "git cherry-pick"
  - "git rebase -i"
  - "git revert --no-commit"
answer: 2
explanation: "An interactive rebase lets you mark each typo commit as fixup, folding it into the commit it corrects."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
