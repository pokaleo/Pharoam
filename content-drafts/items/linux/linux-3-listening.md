---
schema: assessment-item/1
slug: linux-3-listening
skills: [linux]
level: 3
format: mcq
prompt: "A service won't start because its port is already in use. Which command shows what is listening on it?"
options:
  - "ss -ltnp"
  - "ss -tn state established"
  - "ip route show"
  - "netstat -i"
answer: 0
explanation: "ss -ltnp lists listening TCP sockets with the process that owns each."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
