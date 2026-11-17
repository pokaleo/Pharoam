---
schema: assessment-item/1
slug: linux-2-ssh-keys
skills: [linux]
level: 2
format: mcq
prompt: "Which file on the server lists the public keys allowed to sign in as a user?"
options:
  - "~/.ssh/authorized_keys"
  - "~/.ssh/known_hosts"
  - "~/.ssh/id_ed25519"
  - "/etc/ssh/ssh_config"
answer: 0
explanation: "sshd checks the user's authorized_keys, whereas known_hosts records servers you've connected to."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
