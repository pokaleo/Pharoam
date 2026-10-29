/**
 * Builds the built-in content pack from `data/` and `content/` (ADR-0005, AD16).
 *
 * @remarks The compiling and checking happen in the core (`compileContentPack`); this module only reads the files
 * and writes the result, so the same rules apply to the built-in pack and to packs loaded later.
 * @packageDocumentation
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  compileContentPack,
  type ContentFile,
  type InvalidContentError,
  type Result,
} from "../../packages/core/src/index.ts";

const CONTENT_DIRS = ["data", "content"];

/**
 * Reads every content record in the repository.
 *
 * @param root - The repository's root folder.
 * @returns Each Markdown file in `data/` and `content/`, except READMEs, with its path relative to `root`.
 */
export function readContentFiles(root: string): ContentFile[] {
  return CONTENT_DIRS.flatMap((dir) =>
    readdirSync(path.join(root, dir), { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".md") && path.basename(file) !== "README.md")
      .map((file) => {
        const relative = path.join(dir, file);
        return {
          path: relative.split(path.sep).join("/"),
          text: readFileSync(path.join(root, relative), "utf8"),
        };
      }),
  );
}

/**
 * Compiles the repository's content and writes the pack as `<name>-<version>.json`.
 *
 * @remarks Nothing is written when the content is invalid, so a broken pack can never replace a good one.
 * @param root - The repository's root folder.
 * @param outDir - Where to write the pack; created if needed.
 * @returns The written file's path, or every problem that stopped the build.
 */
export function buildPack(root: string, outDir: string): Result<{ file: string }, InvalidContentError> {
  const compiled = compileContentPack(readContentFiles(root));
  if (!compiled.ok) return compiled;
  const { name, version } = compiled.value.manifest;
  const file = path.join(outDir, `${name}-${version}.json`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(file, `${JSON.stringify(compiled.value, null, 2)}\n`);
  return { ok: true, value: { file } };
}
