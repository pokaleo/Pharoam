---
schema: assessment-item/1
slug: data-modelling-4-time-series
skills: [data-modelling]
level: 4
format: mcq
prompt: "Sensor readings arrive at 100,000 a second and are mostly queried by recent time range. Which model fits best?"
options:
  - "One row per sensor, updated in place with each reading"
  - "Append-only rows partitioned by time, with old partitions summarised or dropped"
  - "A fully normalised schema with one table per sensor"
  - "One document per sensor holding all its readings"
answer: 1
explanation: "Time partitions make writes cheap appends, keep recent queries small, and let old data be dropped whole."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
