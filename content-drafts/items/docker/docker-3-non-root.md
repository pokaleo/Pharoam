---
schema: assessment-item/1
slug: docker-3-non-root
skills: [docker]
level: 3
format: mcq
prompt: "Your image runs a web app. Which Dockerfile change does most to limit the damage if the app is compromised?"
options:
  - "Pass the database password with ENV, not a config file"
  - "List only the needed ports with EXPOSE"
  - "Run the app as a non-root user, set with USER"
  - "Base it on a latest tag so patches arrive sooner"
answer: 2
explanation: "A non-root user can't modify system files or use root's privileges, while EXPOSE restricts nothing and ENV values are readable in the image."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
