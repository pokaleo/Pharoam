/**
 * Resolves symlinks in paths, so a protected file can't be reached under another name.
 *
 * @packageDocumentation
 */
import path from "node:path";

/**
 * Resolves symlinks in an absolute path, including one that doesn't exist yet.
 *
 * @remarks For a new file, the nearest existing folder is resolved and the rest of the path is kept, which
 * is where the file would be created.
 * @param absolutePath - The path to resolve.
 * @param realpath - Resolves an existing path, or returns `undefined` when it doesn't exist.
 * @returns The path with every symlink in its existing part resolved.
 */
export function canonicalPath(absolutePath: string, realpath: (path: string) => string | undefined): string {
  let existing = path.resolve(absolutePath);
  const missing: string[] = [];
  for (;;) {
    const resolved = realpath(existing);
    if (resolved !== undefined) return path.join(resolved, ...missing.reverse());
    const parent = path.dirname(existing);
    if (parent === existing) return path.resolve(absolutePath);
    missing.push(path.basename(existing));
    existing = parent;
  }
}
