# ADR-0001: Browser-first web app

- **Status:** Accepted
- **Date:** 2026-10-24
- **Covers:** AD1, and the "no server where possible" principle

## Context
Pharoam must hold no profile data on its infrastructure (Charter R11). It must work for three deployment models: Personal, Self-hosted and Operator-hosted (PRD §2). As a solo-developer project, it needs one codebase.

## Decision
- Pharoam is a **web app whose core runs entirely in the browser**, served as static files.
- Services that block browser calls or need a server-held secret (Notion, OAuth, web fetching) go through a **relay** that stores nothing between requests (ADR-0013).
- A desktop app is not planned for now.

## Alternatives rejected
- **Desktop app (Tauri):** operator-hosted deployments would still need a separate web build, and it adds code signing, distribution and updates for a solo developer.
- **A conventional server-side app:** it would hold user data by default, contradicting R11.

## Consequences
- Self-hosting is just serving static files.
- Opening a real local folder works only in Chromium browsers; other browsers rely on other connectors.
- Which services a browser can call directly must be confirmed (spike S1).
