---
schema: assessment-item/1
slug: git-4-trunk
skills: [git]
level: 4
format: mcq
prompt: "A team deploys main several times a day. A feature will take three weeks. How should they keep main releasable?"
options:
  - "Merge small pieces to main behind a feature flag kept off"
  - "Build it on a feature branch, rebased daily, merged at the end"
  - "Cut a release branch now and finish the feature there"
  - "Pause deploys from main until the feature is finished"
answer: 0
explanation: "A feature flag lets unfinished code merge daily without being switched on, so main stays releasable and branches stay short."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
