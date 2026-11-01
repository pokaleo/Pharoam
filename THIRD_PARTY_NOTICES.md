# Third-party notices

Fonts, icons and other assets by others that ship in this repository. Each keeps its own licence, kept beside its files, and none of them is a Pharoam asset ([LICENSING.md](LICENSING.md)). Libraries installed by pnpm are listed in `pnpm-lock.yaml` with their own licences.

## Icons

The interface icons are Lucide's, the set the Pharoam design system draws with. They come from the `lucide-react` package, installed by pnpm at the release the design system records, and only the icons the app uses are bundled into it. They are Lucide's work, never Pharoam assets; the AI monogram beside them is the design system's own glyph and lives in `brand/`.

| Icon set | Authors | Licence | Source | Kept in |
|---|---|---|---|---|
| Lucide | Lucide Icons and Contributors; icons derived from Feather by Cole Bemis | ISC; MIT for the Feather-derived icons | https://github.com/lucide-icons/lucide (`lucide-react` 1.61.0) | The `lucide-react` package, with its `LICENSE` |

## Typefaces

Chosen by the Pharoam design system and loaded by `brand/tokens.css`. Each was subset to WOFF2 by the design system's recorded script; none declares a Reserved Font Name, so the subsets keep their names. Each folder's `SOURCE.md` gives the exact release and character ranges.

| Typeface | Authors | Licence | Source | Kept in |
|---|---|---|---|---|
| Figtree | The Figtree Project Authors | SIL Open Font License 1.1 | https://github.com/erikdkennedy/figtree (v2.0.3) | `fonts/figtree/` |
| Literata | The Literata Project Authors | SIL Open Font License 1.1 | https://github.com/googlefonts/literata (3.103) | `fonts/literata/` |
| JetBrains Mono | The JetBrains Mono Project Authors | SIL Open Font License 1.1 | https://github.com/JetBrains/JetBrainsMono (v2.304) | `fonts/jetbrains-mono/` |
| Noto Sans Arabic | The Noto Project Authors | SIL Open Font License 1.1 | https://github.com/notofonts/arabic (NotoSansArabic-v2.013) | `fonts/noto-sans-arabic/` |
| Noto Naskh Arabic | The Noto Project Authors | SIL Open Font License 1.1 | https://github.com/notofonts/arabic (NotoNaskhArabic-v2.021) | `fonts/noto-naskh-arabic/` |
| Noto Sans Hebrew | The Noto Project Authors | SIL Open Font License 1.1 | https://github.com/notofonts/hebrew (NotoSansHebrew-v3.001) | `fonts/noto-sans-hebrew/` |
