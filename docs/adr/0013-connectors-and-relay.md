# ADR-0013: Connectors in the repo; a relay that stores nothing

- **Status:** Accepted
- **Date:** 2026-10-24
- **Covers:** AD12, AD21

## Context
Some services (Notion, OAuth sign-ins, web fetching) can't be called from a browser. Users must keep control of their data path, and the project must never handle user data.

## Decision
- **All connectors live in Pharoam's repo** as standalone, open-source components: a browser part, plus a relay part only where needed.
- **The relay processes data in memory and records nothing.** It runs wherever the deployment runs it: the user's machine (`npx`/Docker on localhost, paired with the app), a self-hosted server, or an operator's server.
- **The Pharoam project never runs a relay.**
- The relay API is small and fixed ([interfaces](../design/interfaces.md) §7).
- **Hono** lets one codebase run on Cloudflare Workers, Node (Docker) and Bun.

## Alternatives rejected
- **An official public relay:** user data would pass through the project's servers, breaking "completely private", and the project would carry cost and abuse risk.

## Consequences
Personal users who want Notion or web fetching must run the relay themselves. Operators must publish modified relay code to their users (AGPL §13). Users of an operator deployment have to trust that operator.
