# ADR-0012: LangChain.js + LangGraph.js for AI pipelines

- **Status:** Accepted (LangGraph subject to spike S2, before v0.3)
- **Date:** 2026-10-24
- **Covers:** AD11a

## Context
Pharoam needs adaptive, multi-step pipelines: diagnostics, profile updates, and later CVs and interview practice. They need user approval points (R5), every diagnostic recorded as evidence (PRD E6), and a relay restricted to known tasks (L3).

## Decision
- **LangChain.js** (core + browser-safe provider packages) and **LangGraph.js**, behind Pharoam's own provider interface.
- Pipelines are **LangGraph graphs whose AI nodes are registered tasks** (ADR-0004). User approvals are **interrupts**.
- **Engine checkpoints live only in the local cache.** The user's storage holds a **readable session log**, and Pharoam rebuilds the checkpoint from it (ADR-0017).
- **LangSmith tracing is off and blocked.** LangChain memory, agents and retrievers are not used.
- AI code is **loaded only in AI-assisted mode**.

## Alternatives rejected
- **Vercel AI SDK:** lighter for single calls, but Pharoam would have to write its own workflow engine (graphs, interrupts, resuming).
- **Free-roaming agents:** they would undermine approval gates, evidence recording and the relay allow-list.

## Consequences
A larger download, and a dependency on how LangChain evolves. A small checkpoint-rebuild layer and a React streaming hook must be written. Spike S2 must prove resuming from the readable log alone.

## Update, 3 November 2026 (v0.2)
v0.2's AI features are single calls: normalising pasted text, suggesting levels and skill links, and explaining a gap. The review queue's accept and skip are plain actions on a readable session file, so nothing in v0.2 pauses and resumes. **v0.2 therefore uses LangChain chat models behind the provider interface, without LangGraph.** LangGraph, the checkpoint-rebuild layer and spike S2 arrive with v0.3, whose diagnostics are the first workflows that pause and resume. The decision itself stands; only its timing changes.
