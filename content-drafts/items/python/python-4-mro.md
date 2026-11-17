---
schema: assessment-item/1
slug: python-4-mro
skills: [python]
level: 4
format: mcq
prompt: "class D(B, C), where B and C both inherit from A and define greet(). Which greet() does D().greet() call?"
options:
  - "B's, by the method resolution order D, B, C, A"
  - "C's, as the last base wins"
  - "A's, as the shared base wins"
  - "It raises an error for the ambiguity"
answer: 0
explanation: "Python's C3 linearisation gives D, B, C, A, so B's method is found first."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
