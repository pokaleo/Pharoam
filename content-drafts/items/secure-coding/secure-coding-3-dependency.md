---
schema: assessment-item/1
slug: secure-coding-3-dependency
skills: [secure-coding]
level: 3
format: mcq
prompt: "A scanner reports a critical vulnerability in a library deep in your dependency tree. What is the sound first step?"
options:
  - "Ignore it, as you didn't install that library directly"
  - "Remove the scanner from CI so builds pass"
  - "Check whether the vulnerable code is reachable in your use, then upgrade or override the version, in that priority"
  - "Fork the library and maintain it yourself from now on"
answer: 2
explanation: "Transitive dependencies ship in your app; reachability tells you how urgent the fix is."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
