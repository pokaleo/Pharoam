/**
 * TDD check: every changed production source file must come with a test (ENGINEERING §1).
 *
 * @packageDocumentation
 */

const SOURCE = /^(?:packages|apps)\/[^/]+\/src\/.+\.(tsx?)$/;
const EXEMPT = /(?:\.test\.tsx?|\.d\.ts|\/index\.tsx?)$|\/__fixtures__\//;

/**
 * Finds changed source files that have no test.
 *
 * @remarks A source file passes when its `.test.ts` or `.test.tsx` neighbour changed in the same commit or
 * already exists. Index files, type declarations and fixtures are exempt.
 * @param changedFiles - Repo-relative paths of the changed files.
 * @param fileExists - Tells whether a repo-relative path exists.
 * @returns The source files that have no test, in the order given.
 */
export function findUntestedSources(
  changedFiles: readonly string[],
  fileExists: (path: string) => boolean,
): string[] {
  const changed = new Set(changedFiles);
  return changedFiles.filter((file) => {
    const match = SOURCE.exec(file);
    if (!match || EXEMPT.test(file)) return false;
    const base = file.slice(0, -(match[1]?.length ?? 0) - 1);
    const candidates = [`${base}.test.ts`, `${base}.test.tsx`];
    return !candidates.some((test) => changed.has(test) || fileExists(test));
  });
}
