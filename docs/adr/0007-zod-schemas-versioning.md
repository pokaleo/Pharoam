# ADR-0007: Zod schemas, published JSON Schema, versioned records

- **Status:** Accepted
- **Date:** 2026-10-24
- **Covers:** AD7

## Context
Records must be validated, the format must stay stable for years (PRD N6), and other tools should be able to read it.

## Decision
- Shapes are defined in TypeScript with **Zod**.
- A **JSON Schema** is generated and published for each format version.
- Every record declares its type and version (for example `schema: evidence/1`). Older records are **upgraded automatically when read**.

## Alternatives rejected
- **JSON Schema written by hand:** more neutral, but clumsier to write and maintain.

## Consequences
Zod is the source of truth, and a build step publishes the neutral contract.
