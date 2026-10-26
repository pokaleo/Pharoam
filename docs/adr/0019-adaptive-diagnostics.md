# ADR-0019: Adaptive diagnostics; a tested level rests only on shown performance

- **Status:** Accepted
- **Date:** 2026-10-26
- **Covers:** PRD E, [Data model](../design/data-model.md) §6–§7

## Context
Evidence such as jobs, repositories and certificates shows that a person used a skill, not at what level. Claims can be wrong in either direction. Pharoam needs levels that rest on what the person can show, that work without AI, and that get more accurate when AI is available, without letting a long CV buy a high level.

## Decision
- **A tested level rests only on what the person shows in a diagnostic.** Claims and evidence decide where a diagnostic starts, what it probes and what its explanation says, never the level.
- **Diagnostics are adaptive:** harder after right answers, easier after wrong ones, until the level is clear.
- **Question-bank diagnostic** (no AI): reviewed multiple-choice items tagged by skill and level, starting at the claimed level (or level 2), marked by a fixed, published rule. Result: `demonstrated`, with a note that the evidence wasn't considered.
- **AI-led diagnostic** (AI-assisted mode): starts where the evidence points, mixes multiple-choice, open answers and practical tasks (marked by AI review, ADR-0014), and uses earlier question-bank results as input. Result: `ai-correlated`, with an explanation comparing the session with the person's claims and evidence in either direction, likely reasons as possibilities, and a next step.
- **Every diagnostic is recorded in full** as `assessment` evidence and is never edited. Its observation links to it.
- **Results need no acceptance.** The person can run the diagnostic again; the latest result counts and every attempt stays in the history.
- **AI judgements from evidence** (`ai-judged`) are claims: they count only once accepted and never count as tested.

## Alternatives rejected
- **Levels backed by linked evidence:** a link shows that a skill was used, and the level is still the person's own choice.
- **An AI level weighing the session and the evidence together:** claims could raise a level the person couldn't show, and minimal mode would have no equivalent.
- **Fixed, non-adaptive tests:** experienced people waste time on easy items, and the level is found more slowly.
- **The best attempt counts:** invites retaking until a lucky run.

## Consequences
The question bank is a large content task: items must really test the level they are tagged with. AI-led results vary more between runs than question-bank results, so they always show what was considered and how they were marked. An answer in an AI-led diagnostic can try to steer the marking, which the security model covers ([security](../design/security.md) §3). Until v0.3 ships diagnostics, no level is tested, so the gap view shows nothing as *supported*.
