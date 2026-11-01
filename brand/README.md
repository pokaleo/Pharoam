# Pharoam brand files

The finished design-system files the web app uses, and nothing else ([LICENSING.md](../LICENSING.md)). All rights reserved under [LICENSE.md](LICENSE.md).

| File | Used for |
|---|---|
| `tokens.css` | Every colour, type, density, shape and motion value, for light and dark, plus the shadcn/ui names mapped onto Pharoam roles |
| `wordmark.svg`, `wordmark-reversed.svg` | The wordmark at the top of every page, on light and dark grounds |
| `favicon.svg` | The browser tab icon |
| `seal.svg`, `seal-reversed.svg` | The seal in the phone top bar and the footer, on light and dark grounds |
| `ai-monogram.svg` | The AI monogram on everything AI-made: AI judgements, AI correlated results, AI-drafted pathways |

**Source:** the Pharoam design system, commit `c7c3d3a` (27 October 2026). Files are copied unchanged, except `ai-monogram.svg`: the design system keeps it as a sprite symbol in `assets/js/glyphs.js`, so its shape is copied unchanged into a standalone file with the icon stroke (1.75, round) the sprite gets from its stylesheet. To update them, copy the new versions over these and record the commit here. Never edit them in this repository.

**Fonts are not here.** `tokens.css` loads them from `../fonts/`, where each typeface keeps its own licence ([THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)).

**Without this folder** the app builds and runs with the neutral theme in `apps/web/src/theme/neutral/`, so forks can follow the AGPL without the Pharoam brand ([TRADEMARKS.md](../TRADEMARKS.md)).
