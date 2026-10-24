# ADR-0010: Connector behaviour and saving and syncing

- **Status:** Accepted
- **Date:** 2026-10-24
- **Covers:** AD10, AD10a

## Context
The user can edit their data outside Pharoam (for example in Obsidian). Pharoam writes to the same storage. Data must never be lost silently.

## Decision
- **One storage backend per profile at a time.** Moving between backends is an export and an import.
- **Connectors exchange records, not raw files** ([interfaces](../design/interfaces.md) §1). Version tokens detect changes made elsewhere.
- **Automatic save** (writes immediately, or queued for remote storage), a **status indicator**, **automatic refresh** when the app opens or regains focus, and a **"Sync now"** button.
- **Conflicts** are flagged on the affected record and **never silently overwritten**. The user chooses which version to keep.

## Alternatives rejected
- **Syncing across several backends:** a product in itself.
- **Manual save and sync only:** easy to forget, and data gets lost.
- **Last write wins:** loses the user's edits silently.

## Consequences
Background writing and refreshing add complexity. Every connector must provide version tokens and a way to list changes.
