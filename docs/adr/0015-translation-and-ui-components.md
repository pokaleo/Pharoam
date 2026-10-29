# ADR-0015: Translation and UI components

- **Status:** Accepted (design system decided, October 2026)
- **Date:** 2026-10-24
- **Covers:** AD14

## Context
English first, but built for translation (PRD N9) and accessibility (N5).

## Decision
- **react-i18next**, with all interface text in translation files from day one, loaded per language on demand. Content packs carry their own translations.
- **shadcn/ui** (Radix + Tailwind) is the preferred component base.
- Automated accessibility checks (axe) for WCAG 2.2 AA.
- **The design system** is the founder's, made with dedicated design tools outside this repository (AD14a). The app takes its finished token file and artwork, copied unchanged into `brand/`, through the `@brand/` alias (`apps/web/src/build/brand.ts`). Its fonts are third-party (SIL OFL) and live in `fonts/`, listed in `THIRD_PARTY_NOTICES.md`.
- **Components are AGPL code**, written with Tailwind against the design system's token names (including the shadcn/ui names it maps onto Pharoam's roles), so they look whole with either theme. The design system's own stylesheets are a reference, not a dependency.

## Alternatives rejected
- **React Aria Components:** slightly stronger on accessibility, but slower to build with for a solo developer.

## Consequences
The design system is the founder's own asset, kept outside this repository and not under the AGPL ([LICENSING.md](../../LICENSING.md)). The app takes the Pharoam theme and artwork from `brand/` and must still build and run without that folder, falling back to the neutral theme and artwork in `apps/web/src/theme/neutral/`, so that forks can follow the AGPL without the Pharoam brand. A test checks that the neutral theme defines every token the Pharoam one does.
