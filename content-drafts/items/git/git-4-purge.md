---
schema: assessment-item/1
slug: git-4-purge
skills: [git]
level: 4
format: mcq
prompt: "A secret was committed months ago to a shared repository. You remove it from history with git filter-repo and force-push. What else must you do?"
options:
  - "Nothing; the force-push removes it from every clone"
  - "Run git gc on your machine so the old objects go"
  - "Rotate the secret, and have everyone re-clone rather than pull"
  - "Tag the old history so it can be restored if needed"
answer: 2
explanation: "Old clones, forks and host caches still hold the commits, so the secret is leaked and must be rotated, and old clones replaced."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
