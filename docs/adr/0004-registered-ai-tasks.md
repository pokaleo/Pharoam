# ADR-0004: Every AI feature is a registered task

- **Status:** Accepted
- **Date:** 2026-10-24
- **Covers:** AD4

## Context
AI output must be labelled and disclaimed (PRD D6), inspectable (D4), and validated before use. Operator relays must refuse arbitrary prompts (L3).

## Decision
Every AI feature is a **named, versioned task definition** in `packages/core`. It contains:
- the input schema;
- the prompt template;
- the output schema;
- the label and disclaimer;
- the list of data used.

The app and the relay share these definitions. Output is validated against the output schema before the user sees it. **The relay runs registered tasks only.**

## Alternatives rejected
- **Prompts written directly in UI code:** faster at first, but untestable, unlabelled, and impossible for a relay to restrict.

## Consequences
Every AI feature takes more up-front work. In return, validation, labelling, transparency and abuse protection all come from one definition.

## Update, 4 November 2026 (v0.2)
- **The label and disclaimer move out of the task definition** into the web app's translation files, under the task's name. They are interface text, which hard rule 12 keeps out of code.
- **The list of data used is the task's `data` function**: it returns exactly the parts the task sends, so what the person is shown and what is sent can't drift apart.
- **The core runs the task, not the provider**: `runTask` checks the answer against the output schema and makes the call record, and providers only send the request the core prepared (interfaces §2, §3).

