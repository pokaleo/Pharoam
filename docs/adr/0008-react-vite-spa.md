# ADR-0008: React + Vite single-page app

- **Status:** Accepted
- **Date:** 2026-10-24
- **Covers:** AD8, AD17, AD18

## Context
The app is static (ADR-0001), must meet WCAG 2.2 AA (PRD N5) and support translation (N9), and is built by one developer with AI assistance.

## Decision
- **React + Vite**, built as a static single-page app. No server-side framework.
- **TanStack Query** wraps calls to the core service and refreshes on its change events. **Zustand** holds UI-only state.
- **TanStack Router** with **hash-based URLs**, so the app runs on any static host with no server configuration.

## Alternatives rejected
- **Svelte or Vue:** smaller ecosystems for accessibility and translation.
- **Next.js and other server frameworks:** there is no server.
- **Path-based URLs:** they need rewrite rules on every host.

## Consequences
A larger bundle than lighter frameworks, and less tidy URLs.
