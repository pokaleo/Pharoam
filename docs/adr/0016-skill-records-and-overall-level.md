# ADR-0016: One file per skill; overall level by AI only

- **Status:** Accepted
- **Date:** 2026-10-24
- **Covers:** [Data model](../design/data-model.md) §6

## Context
The profile should give a clear picture of the person. Skill history must stay an honest audit trail (R4–R6). A single proficiency indicator is wanted, but a hidden formula would conceal where the level came from.

## Decision
- **One `.md` file per skill.** Its top block holds an **append-only history** of observations and reviews, and a regenerated **proficiency** summary by source.
- An optional **overall level is produced only by an AI task**, weighing all evidence and giving self-reports low weight. It is labelled, explained, and records its inputs. It's **recalculated automatically and visibly** when the skill changes (batched), with a manual refresh button. The user can dismiss it or mark "I disagree"; no acceptance is needed. It never feeds back into the history.
- **In minimal mode only the per-source levels are shown.**

## Alternatives rejected
- **One file per observation:** hundreds of small files, and a skill's story is scattered.
- **A precedence rule or weighted formula for the headline:** a hidden formula, or a less useful single view.

## Consequences
Appending to a shared skill file can rarely conflict across devices. AI recalculation costs tokens, which batching mitigates. Charter R4 was updated to match.
