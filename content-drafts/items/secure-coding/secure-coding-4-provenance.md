---
schema: assessment-item/1
slug: secure-coding-4-provenance
skills: [secure-coding]
level: 4
format: mcq
prompt: "How can an organisation make sure the artefacts it deploys were built from its own reviewed source?"
options:
  - "Scanning the artefacts for viruses after deployment"
  - "Giving every developer the deployment keys"
  - "Always using the latest version of every dependency"
  - "Signed build provenance, for example to SLSA, verified before deployment"
answer: 3
explanation: "Provenance links an artefact to the source and build that made it, so tampering is detected."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
