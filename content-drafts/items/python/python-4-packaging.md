---
schema: assessment-item/1
slug: python-4-packaging
skills: [python]
level: 4
format: mcq
prompt: "A library pins an exact version of a dependency (requests==2.31.0) in its package metadata. What problem does that cause?"
options:
  - "The library will no longer import"
  - "Python ignores exact pins in libraries"
  - "Applications using it can't install any other version, so it conflicts with their other dependencies"
  - "It makes installation slower but has no other effect"
answer: 2
explanation: "Libraries should declare compatible ranges; exact pins belong in an application's lock file."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
