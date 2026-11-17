---
schema: assessment-item/1
slug: linux-3-sshd
skills: [linux]
level: 3
format: mcq
prompt: "Which change hardens a public SSH server most?"
options:
  - "Turn off password and root sign-in, allowing keys only"
  - "Move SSH to port 2222 and change nothing else"
  - "Allow root sign-in with a long password"
  - "Install fail2ban, keeping password sign-in on"
answer: 0
explanation: "Key-only access without root removes password guessing, the most common attack."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
