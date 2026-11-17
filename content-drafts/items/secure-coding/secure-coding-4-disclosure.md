---
schema: assessment-item/1
slug: secure-coding-4-disclosure
skills: [secure-coding]
level: 4
format: mcq
prompt: "A researcher reports a vulnerability in your open-source library that many products use. What is the sound process?"
options:
  - "Fix it in a public pull request at once, so users can review the change"
  - "Fix it privately, then release the fix and a CVE advisory on an agreed date"
  - "Release the fix quietly in a minor version, with no advisory"
  - "Publish an advisory now, and fix it in the next scheduled release"
answer: 1
explanation: "Coordinated disclosure gets the fix out before details are public, and the advisory tells users to upgrade."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
