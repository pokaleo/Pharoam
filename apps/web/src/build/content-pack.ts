/**
 * The built-in content pack, compiled into the app at build time.
 *
 * @remarks The app ships with the default bundle, so it works offline (AD5, AD16). Vite compiles `data/` and
 * `content/` with the core's compiler as the app builds, so the app never ships a stale or invalid pack; invalid
 * content fails the build. Runs in Node, from the Vite config.
 * @packageDocumentation
 */
import { compileContentPack, err, ok, type ContentFile, type Result } from "@pharoam/core";
import type { Plugin } from "vite";

/** The module name the app imports the pack by. */
export const CONTENT_PACK_MODULE = "virtual:pharoam/content-pack";

// Vite's convention for a virtual module's resolved ID, which keeps other plugins from processing it.
const RESOLVED = `\0${CONTENT_PACK_MODULE}`;

/**
 * Compiles the content into the source of a module whose default export is the pack.
 *
 * @param files - Reads every content file, such as `readContentFiles(repoRoot)`.
 * @returns The module's source, or every problem that stopped the pack compiling, one per line.
 */
export function contentPackModule(files: () => readonly ContentFile[]): Result<string, string> {
  const pack = compileContentPack(files());
  if (!pack.ok) {
    const problems = pack.error.problems.map(
      (p) => `  - ${p.path === "" ? "the pack" : p.path}: ${p.message}`,
    );
    return err(`The content pack can't be built:\n${problems.join("\n")}`);
  }
  return ok(`export default ${JSON.stringify(pack.value)};\n`);
}

/**
 * A Vite plugin that serves the compiled pack as `virtual:pharoam/content-pack`.
 *
 * @param files - Reads every content file, each time the module is built.
 * @returns The plugin.
 */
export function contentPack(files: () => readonly ContentFile[]): Plugin {
  return {
    name: "pharoam-content-pack",
    resolveId: (id) => (id === CONTENT_PACK_MODULE ? RESOLVED : undefined),
    load(id) {
      if (id !== RESOLVED) return undefined;
      const code = contentPackModule(files);
      if (!code.ok) this.error(code.error);
      return code.value;
    },
  };
}
