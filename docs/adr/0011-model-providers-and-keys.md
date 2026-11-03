# ADR-0011: Model providers and keys

- **Status:** Accepted
- **Date:** 2026-10-24
- **Covers:** AD11

## Context
Pharoam must not depend on one model provider (PRD N3), must support local models, and must protect users' API keys.

## Decision
- Adapters for **Anthropic** and **any OpenAI-compatible API** (OpenAI, OpenRouter, Ollama, LM Studio), behind Pharoam's provider interface.
- Keys are **session-only by default**, with an opt-in "remember on this device" (encrypted, ADR-0009).
- On operator deployments, a user's own key is used per request and never stored.
- A strict content security policy.

## Alternatives rejected
- **Remembering keys by default:** too much exposure on shared devices.

## Consequences
Users with session-only keys re-enter them each session.

## Update, 3 November 2026 (v0.2)
- **The hosted app reaches a fixed list of provider addresses**: Anthropic, OpenAI, OpenRouter, and `localhost` for Ollama or LM Studio. The content security policy is written into the built page, so it can't allow an address the person types in (security §4). Any other OpenAI-compatible address needs a self-hosted build with its own list. Spike S1 confirms the list.
- **v0.2 keys are session-only, with no "remember on this device" yet.** Remembering a key needs the encrypted cache and spike S3, which come later (MVP §7).
