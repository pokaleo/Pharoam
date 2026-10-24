# ADR-0015: Translation and UI components

- **Status:** Accepted (design system deferred)
- **Date:** 2026-10-24
- **Covers:** AD14

## Context
English first, but built for translation (PRD N9) and accessibility (N5).

## Decision
- **react-i18next**, with all interface text in translation files from day one, loaded per language on demand. Content packs carry their own translations.
- **shadcn/ui** (Radix + Tailwind) is the preferred component base.
- Automated accessibility checks (axe) for WCAG 2.2 AA.
- **The design system and theming are decided later** with dedicated design tools (AD14a).

## Alternatives rejected
- **React Aria Components:** slightly stronger on accessibility, but slower to build with for a solo developer.

## Consequences
Until the design system exists, the default shadcn theme is used.
