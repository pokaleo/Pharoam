---
schema: assessment-item/1
slug: data-modelling-4-tenancy
skills: [data-modelling]
level: 4
format: mcq
prompt: "A SaaS database keeps thousands of customers' data in shared tables with a tenant_id column. What must the model and access layer guard against most?"
options:
  - "Running out of IDs, as all tenants share one sequence"
  - "Primary keys clashing between tenants' rows"
  - "A query without the tenant filter, exposing one tenant's data"
  - "Foreign keys slowing inserts across all tenants"
answer: 2
explanation: "Shared tables need the tenant filter enforced everywhere, for example with row-level security."
origin: { source: Pharoam content, licence: CC-BY-SA-4.0 }
ai:
  task: draft-item@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-17T09:00:00Z
---
