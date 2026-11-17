---
schema: assessment-item/1
slug: secure-coding-2-leaked-key
skills: [secure-coding]
level: 2
format: mcq
prompt: "An API key was pushed to a public repository, and removed in the next commit. What must happen?"
options:
  - "Revoke the key and issue a new one"
  - "Nothing: the next commit removed it"
  - "Make the repository private"
  - "Rewrite the history to remove the commit"
answer: 0
explanation: "Public repositories are scanned for secrets within minutes; a leaked key must be treated as compromised."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
