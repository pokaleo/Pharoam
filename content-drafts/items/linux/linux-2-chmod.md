---
schema: assessment-item/1
slug: linux-2-chmod
skills: [linux]
level: 2
format: mcq
prompt: "Which command lets deploy.sh's owner run it as a program?"
options:
  - "chown u+x deploy.sh"
  - "chmod 644 deploy.sh"
  - "chmod u+x deploy.sh"
  - "chmod o-x deploy.sh"
answer: 2
explanation: "u+x adds execute for the owner, whereas 644 gives the owner read and write and everyone else read, with no execute."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
