---
schema: assessment-item/1
slug: python-4-mro
skills: [python]
level: 4
format: mcq
prompt: "A defines greet(); B(A) doesn't; C(A) overrides it; class D(B, C). Which greet() does D().greet() call?"
options:
  - "A's, found through B"
  - "C's"
  - "It raises TypeError for the ambiguity"
  - "Both A's and C's, in turn"
answer: 1
explanation: "C3 linearisation gives D, B, C, A, so C comes before the shared base A."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
