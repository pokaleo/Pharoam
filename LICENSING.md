# Licensing

Pharoam's **code is open source**. Pharoam's **brand and design system are not**: they are the founder's own assets. This page says which is which, so that nobody (us included) mixes them up.

This page explains the licences. Where it and a licence text differ, the licence text wins: [LICENSE](LICENSE) for the code, [content/LICENSE](content/LICENSE) for the content, [data/LICENSE](data/LICENSE) for the skill vocabulary, [schemas/LICENSE](schemas/LICENSE) for the published JSON Schemas, the brand notice (below) for the brand files, and each third-party licence for its own files.

## At a glance

| What | Owner | Licence | Where |
|---|---|---|---|
| Source code, tests, tooling and configuration | The Pharoam authors | [AGPL-3.0-only](LICENSE) | This repository, outside `brand/`, `content/`, `data/` and `schemas/` |
| Documentation (`docs/`, the README files) | The Pharoam authors | AGPL-3.0-only, as part of this repository | This repository |
| Pathways and other content Pharoam writes | The Pharoam authors | [CC BY-SA 4.0](content/LICENSE) | `content/` |
| The skill vocabulary (forked from the MIND Tech Ontology) | The MIND authors and the Pharoam authors | [MIT](data/LICENSE) | `data/` |
| The published JSON Schemas for Pharoam's file formats | The Pharoam authors | [CC0 1.0](schemas/LICENSE): no conditions | `schemas/` |
| The Pharoam name, logo and wordmark | The Pharoam founder | **Not licensed.** See [TRADEMARKS.md](TRADEMARKS.md) | `brand/` |
| **The Pharoam design system** | The Pharoam founder | **All rights reserved. Not open source, not licensed** | **Outside this repository** |
| Brand files the app or website uses (artwork, theme) | The Pharoam founder | All rights reserved, under the brand notice | `brand/` only |
| Third-party libraries | Their authors | Their own licences | Installed by pnpm, listed in `pnpm-lock.yaml` |
| Third-party fonts and icon sets | Their authors | Their own open licences, for example SIL OFL 1.1 | Their own folders, each with its licence text |
| Other skill and occupation data | Their publishers | Their own licences (for example ESCO's reuse terms) | A subfolder of `data/`, with its own LICENSE and NOTICE files |

## The code: AGPL-3.0-only

Everything in this repository outside `brand/`, `content/`, `data/`, `schemas/` and the third-party folders is licensed under the GNU Affero General Public License v3.0 only. Anyone may use, study, change and share it, commercially too. Anyone who runs a modified version as a network service must offer that service's users its source code. Copyright stays with the original authors ([Charter](docs/CHARTER.md) §7).

## Content and data: open, under their own licences

Content and data are not software, so they don't use the AGPL. Both are compiled into the app's content bundle and shipped alongside the code, not as part of it (an "aggregate", AGPL section 5). The bundle's manifest lists each licence.

- **`content/`: CC BY-SA 4.0.** The pathways, and later the assessment items, that Pharoam writes. Anyone may share and adapt them, commercially too, with credit, and must share changed versions under the same licence: the same give-back the AGPL asks of the code. See [content/README.md](content/README.md).
- **`data/`: MIT.** The skill vocabulary, forked from the [MIND Tech Ontology](https://github.com/MIND-TechAI/MIND-tech-ontology) (MIT). Pharoam's changes are MIT too, so the vocabulary keeps one licence. Data from other sources goes in its own subfolder with its own licence; share-alike data is never merged into the MIT files. When ESCO data is used, the app shows ESCO's required statement and marks what Pharoam changed. See [data/README.md](data/README.md).

Neither licence grants any right to the Pharoam name, logo or brand.

## The design system: our own assets

The **Pharoam design system** is the founder's own work. It includes:

- the visual identity: the logo, the wordmark, the colour palette, the typography choices and the overall look;
- the brand book and its usage rules;
- the design tokens and the Pharoam theme;
- artwork made for Pharoam: illustrations, icons, images and favicons;
- component, page and screen designs, mock-ups and prototypes.

The design system is **kept outside this repository**. It is not part of Pharoam's source code, it is **not covered by the AGPL**, and nothing in this repository grants a licence to it. Seeing it, whether in the running app, in screenshots or on the website, gives no right to copy it.

### Where the design system meets the code

The app is built on the design system, so the two touch. The boundary is one folder, `brand/`:

1. **`brand/` is ours.** The design-system files the app or website actually uses, such as finished artwork and the Pharoam theme (token values and the brand stylesheet), are kept in `brand/` and nowhere else. Every file there is all rights reserved under the brand notice. These files are shipped *alongside* the AGPL code, not as part of it (an "aggregate", AGPL section 5).
2. **Everything outside `brand/` is AGPL code.** Components, layouts and other code that *use* the design system are software, licensed under the AGPL. They read the theme and artwork from `brand/`. The AGPL licenses that code. It does not license the Pharoam brand. As AGPL section 7(e) allows, **no rights are granted under trademark law** to the Pharoam name, logo or brand.
3. **The app works without `brand/`.** If `brand/` is removed, the app still builds and runs, with neutral artwork and the default theme. Anyone who receives the code can then build, run and change it, as the AGPL promises, without needing our brand. Forks start from there.
4. **The design system's source never enters this repository.** No brand book, design files, layered or source artwork, mock-ups or exports: only the finished files in `brand/` that are actually used.

### The brand notice

`brand/` holds a `LICENSE.md` with this text, and keeps it:

> Copyright © 2026 the Pharoam founder. All rights reserved.
>
> The files in this folder are part of the Pharoam brand and design system. They are **not** covered by the GNU Affero General Public License that applies to the rest of this repository, and no licence to them is granted by it or by any other file in this repository.
>
> You may keep these files, unchanged, in a copy of this repository, and use them unchanged to build and run the unmodified Pharoam app for yourself or within your own organisation. Any other use, including in a modified version, a fork you share or deploy, a service offered to others, or another product, needs written permission from the founder. See [TRADEMARKS.md](../TRADEMARKS.md).

## Third-party fonts and icons

The design system may *choose* third-party fonts and icon sets. The choice is ours; **the fonts and icons are not**. They stay their authors' work under their own licences, and we never present them as Pharoam assets.

- **Allowed licences:** SIL Open Font License 1.1, Apache-2.0, MIT, ISC, CC0-1.0, or another licence that allows bundling, self-hosting, changing and redistributing in an open-source project, commercial use included.
- **Not allowed:** "free for personal use", licences that forbid redistribution or web embedding, and commercial licences that do not cover open-source redistribution.
- **Get them from the official source** (the foundry's or author's own repository), not from download mirrors.
- **Self-host them.** No font or icon CDN, because the app makes no third-party requests (AGENTS hard rule 7).
- **Keep the licence text beside the files**, in the font's or icon set's own folder, and **never inside `brand/`** (the brand notice must not appear to cover them).
- **Respect Reserved Font Names:** if a font under the SIL OFL is changed, subsetting included, it must not keep a Reserved Font Name. Ship it under a new name, or use the unchanged files.
- **List each one** in a `THIRD_PARTY_NOTICES.md` file at the repository root, created with the first such asset: name, author, licence, source URL and where it is kept.

## Forks and redistribution

The AGPL lets anyone fork and share the code. A fork that is shared or deployed must remove `brand/`, use its own name and artwork, and must not look like the official Pharoam. [TRADEMARKS.md](TRADEMARKS.md) has the details.

## Contributions

Outside pull requests are not accepted yet ([CONTRIBUTING](CONTRIBUTING.md)). When they are, the contributor terms will cover code, documentation, content and data only. **Changes to `brand/` and to the design system come only from the founder** or from someone the founder has asked in writing.

## Adding something to this repository

| You are adding | Then |
|---|---|
| Code or documentation | Nothing extra: it is AGPL-3.0-only |
| A file from the design system | Only a finished file the app or website uses, only in `brand/` |
| A third-party font, icon set, image or other asset | Check the licence is allowed; put it in its own folder with its licence text; list it in `THIRD_PARTY_NOTICES.md` |
| Pathways or other content Pharoam writes | `content/`: it is CC BY-SA 4.0 |
| A JSON Schema for a file format | Generated into `schemas/` from the Zod schemas; it is CC0 1.0 |
| Skill or occupation data | `data/`, following [data/README.md](data/README.md): MIT data in `data/`, other licences in their own subfolder with LICENSE and NOTICE files and any required attribution |
| Anything whose source or licence is unknown | Don't add it |

## Questions and permission

To ask about licensing or to request permission to use the brand, open an issue titled "Brand use request", or contact the maintainer privately through [GitHub](https://github.com/pokaleo). Permission counts only when it is given in writing by the founder.
