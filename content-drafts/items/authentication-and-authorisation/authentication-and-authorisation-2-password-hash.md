---
schema: assessment-item/1
slug: authentication-and-authorisation-2-password-hash
skills: [authentication-and-authorisation]
level: 2
format: mcq
prompt: "How should a server store people's passwords?"
options:
  - "Hashed with a slow, salted password hash, such as Argon2, bcrypt or scrypt"
  - "Encrypted with a key kept on the same server"
  - "Hashed once with SHA-256"
  - "As plain text in a column only admins can read"
answer: 0
explanation: "Slow salted hashes make stolen hashes expensive to crack; encryption can be reversed with its key."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
