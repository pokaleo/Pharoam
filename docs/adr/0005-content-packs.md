# ADR-0005: Content as versioned packs

- **Status:** Accepted
- **Date:** 2026-10-24
- **Covers:** AD5, AD16

## Context
The skill inventory, pathways and assessment items change on their own schedule (for example the quarterly inventory refresh). Operators may want their own content. Minimal mode must work offline.

## Decision
- A **default content bundle** ships with the app.
- **Additional versioned packs** can be loaded from a URL or from the user's own storage. URL packs need the user's confirmation.
- Content is written in the **same Markdown + YAML format and Zod schemas** as profile records, in `content/` and `data/`.
- At build time it is **compiled to a versioned JSON bundle** with a manifest (pack version, minimum app version, licences).
- **Packs are data only, never code.**

## Alternatives rejected
- **Bundled only:** every content change would need a redeploy, and operators couldn't add content.
- **Runtime fetch only:** it breaks offline use and adds network dependence.

## Consequences
Packs need version management and compatibility checks. Signed packs come later.
