# ADR-0016: One file per skill; one shown level by a written order

- **Status:** Accepted
- **Date:** 2026-10-26
- **Covers:** [Data model](../design/data-model.md) §6

## Context
The profile should give a clear picture of the person: one level per skill they can read at a glance. Skill history must stay an honest audit trail (R4–R6). A level from a diagnostic must not be overridden by a later claim, and no hidden formula may decide what is shown.

## Decision
- **One `.md` file per skill.** Its top block holds an **append-only history** of observations and reviews, and a regenerated **proficiency** summary.
- **Each skill shows one level**, chosen by a fixed, written order: the latest diagnostic result (`demonstrated` or `ai-correlated`), otherwise the latest accepted `ai-judged` level, otherwise the latest `self-reported` level. The level is shown with its source and date.
- **A newer claim never replaces a tested level.** A claim newer than the shown tested level that differs from it is shown as a note on the level.
- **The full history is always available**, newest first, with the entry behind the shown level marked.
- The same rules apply in minimal and AI-assisted mode; choosing the shown level needs no AI.

## Alternatives rejected
- **One file per observation:** hundreds of small files, and a skill's story is scattered.
- **Every source's level side by side:** people have to work out which level to believe.
- **A level blended by an AI task or a weighted formula:** claims could raise the level, the result would depend on a model or a hidden formula, and minimal mode would have no level.

## Consequences
Appending to a shared skill file can rarely conflict across devices. The shown level is reproducible from the file alone, inside or outside Pharoam.
