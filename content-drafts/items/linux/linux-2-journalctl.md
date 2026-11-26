---
schema: assessment-item/1
slug: linux-2-journalctl
skills: [linux]
level: 2
format: mcq
prompt: "On a server using systemd, how do you see the nginx service's recent logs?"
options:
  - "systemctl logs nginx"
  - "journalctl -u nginx"
  - "cat /etc/nginx"
  - "ps nginx"
answer: 1
explanation: "journalctl reads systemd's journal; -u picks one unit."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
