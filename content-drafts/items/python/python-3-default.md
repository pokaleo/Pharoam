---
schema: assessment-item/1
slug: python-3-default
skills: [python]
level: 3
format: mcq
prompt: "What is wrong with def add(item, items=[]): items.append(item); return items?"
options:
  - "The default list is created once and shared between calls, so items build up"
  - "Lists can't be default arguments"
  - "append returns None, so the function returns None"
  - "Nothing is wrong with it"
answer: 0
explanation: "Defaults are evaluated once, when the function is defined; use None and create the list inside."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
