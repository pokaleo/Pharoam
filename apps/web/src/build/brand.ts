/**
 * Where the web app takes its theme and artwork from, at build time.
 *
 * @remarks The Pharoam theme and artwork are the founder's own and live only in `brand/`; the app must build and run
 * without that folder, with a neutral theme, so forks can follow the AGPL without the brand (LICENSING.md,
 * ADR-0015). Runs in Node, from the Vite config.
 * @packageDocumentation
 */
import path from "node:path";

/** The files the app imports through `@brand/`: both `brand/` and the neutral theme provide each one. */
export const BRAND_FILES: readonly string[] = [
  "tokens.css",
  "wordmark.svg",
  "wordmark-reversed.svg",
  "favicon.svg",
];

/**
 * Picks the folder `@brand/` resolves to.
 *
 * @remarks All or nothing: a `brand/` missing any file falls back as a whole, so a build never mixes the two themes
 * or fails halfway through.
 * @param repoRoot - The repository's root folder.
 * @param exists - Whether a file exists, such as `fs.existsSync`.
 * @returns `brand/` when it holds every file in {@link BRAND_FILES}, otherwise the neutral theme's folder.
 */
export function brandDirectory(repoRoot: string, exists: (file: string) => boolean): string {
  const brand = path.join(repoRoot, "brand");
  const complete = BRAND_FILES.every((file) => exists(path.join(brand, file)));
  return complete ? brand : path.join(repoRoot, "apps/web/src/theme/neutral");
}
