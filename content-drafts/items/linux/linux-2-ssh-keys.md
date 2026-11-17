---
schema: assessment-item/1
slug: linux-2-ssh-keys
skills: [linux]
level: 2
format: mcq
prompt: "What is the safer way to sign in to a server with SSH?"
options:
  - "A password, typed into the command itself"
  - "The server's private key, copied to your laptop"
  - "Telnet instead of SSH"
  - "A key pair: the private key stays on your machine, the public key goes on the server"
answer: 3
explanation: "Keys can't be guessed like passwords, and the private key never leaves your machine."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
