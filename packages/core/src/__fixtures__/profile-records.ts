// Example profile record files for the schema tests, following the data model's examples (§3–§10).

/** A `pharoam.md` with every field filled in. */
export const PHAROAM_FILE = `---
schema: pharoam/1
id: 0192f3a1-0000-7000-8000-000000000001
created: 2026-10-24T14:02:11Z
updated: 2026-10-25T09:30:00Z
ai: null
headline: Backend engineer moving into machine learning
situation:
  stage: changing-career
  field: Software engineering
region: GB
focus:
  pathways: [ml-engineer]
  skills: [python, pytorch]
preferences:
  mode: minimal
  language: en-GB
---
About me, in my own words.
`;

/** Evidence of a job, with skills linked by hand and by AI. */
export const EVIDENCE_FILE = `---
schema: evidence/1
id: 0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d
created: 2026-10-24T14:02:11Z
updated: 2026-10-24T14:02:11Z
ai: null
kind: job
title: Backend Engineer
organisation: Example Co
start: 2022-09
end: 2024-08
links:
  - https://example.com/payments-api
skills: [python, postgres]
ai-skill-links:
  - skill: postgres
    task: link-skills@1
    model: anthropic/claude-sonnet-5-5
    at: 2026-10-24T14:05:00Z
    confirmed_by_user: 2026-10-24T14:06:00Z
source: manual
---
Built and ran the payments API.
`;

/** A skill record with every provenance, a review, and the generated proficiency summary (data model §6). */
export const SKILL_RECORD_FILE = `---
schema: skill-record/1
id: 0192f3a1-0000-7000-8000-000000000010
created: 2026-10-01T10:00:00Z
ai: null
skill: python
entries:
  - id: 0192f3a1-0000-7000-8000-000000000011
    level: 3
    provenance: self-reported
    observed_at: 2026-10-01T10:00:00Z
    evidence: [0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d]
    integrity: sha256-c1:${"a".repeat(64)}
  - id: 0192f3a1-0000-7000-8000-000000000012
    level: 3
    provenance: ai-judged
    observed_at: 2026-10-05T10:00:00Z
    explanation: Your evidence shows several years of backend Python.
    limits: Based only on the evidence you shared.
    ai:
      task: judge-skill-levels@1
      model: anthropic/claude-sonnet-5-5
      at: 2026-10-05T09:58:00Z
      confirmed_by_user: 2026-10-05T10:00:00Z
  - id: 0192f3a1-0000-7000-8000-000000000013
    level: 2
    provenance: demonstrated
    observed_at: 2026-10-12T10:00:00Z
    assessment: 0192f3a1-0000-7000-8000-000000000020
  - id: 0192f3a1-0000-7000-8000-000000000014
    level: 2
    provenance: ai-correlated
    observed_at: 2026-10-20T10:00:00Z
    assessment: 0192f3a1-0000-7000-8000-000000000021
    explanation: Your answers matched level 2; your evidence suggests more practice with packaging.
    ai:
      task: run-diagnostic@1
      model: anthropic/claude-sonnet-5-5
      at: 2026-10-20T09:40:00Z
  - id: 0192f3a1-0000-7000-8000-000000000015
    level: 4
    provenance: self-reported
    observed_at: 2026-10-24T10:00:00Z
    supersedes: 0192f3a1-0000-7000-8000-000000000011
  - id: 0192f3a1-0000-7000-8000-000000000016
    target: 0192f3a1-0000-7000-8000-000000000012
    decision: retract
    reviewed_at: 2026-10-25T10:00:00Z
    note: The AI read too much into one project.
proficiency:
  shown:
    level: 2
    provenance: ai-correlated
    since: 2026-10-20
    observation: 0192f3a1-0000-7000-8000-000000000014
  newer-claim:
    level: 4
    provenance: self-reported
    since: 2026-10-24
  by-source:
    self-reported: { level: 4, since: 2026-10-24 }
    demonstrated: { level: 2, since: 2026-10-12 }
    ai-correlated: { level: 2, since: 2026-10-20 }
target: 4
---
History, newest first.
`;

/** A gap analysis for one pathway, pinned to a pack version (data model §10). */
export const GAP_FILE = `---
schema: gap/1
id: 0192f3a1-0000-7000-8000-000000000030
created: 2026-10-24T14:02:11Z
updated: 2026-10-25T09:30:00Z
ai: null
pathway: pharoam-core@0.1.0:ml-engineer
requirements:
  - skill: python
    required: 3
    shown: { level: 4, provenance: self-reported }
    group: claimed
    evidence: [0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d]
  - skill: pytorch
    required: 3
    shown: { level: 1, provenance: self-reported }
    group: below
  - skill: mlops
    required: 2
    shown: null
    group: unknown
---
Where you stand against the ML engineer pathway.
`;
