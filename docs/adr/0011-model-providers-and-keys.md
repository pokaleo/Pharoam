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
