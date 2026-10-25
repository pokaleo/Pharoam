/**
 * Files that implement the enforcement itself, or could quietly weaken it. Agents need the user's approval
 * to change them.
 *
 * @packageDocumentation
 */

const PROTECTED_DIRS: readonly string[] = [
  ".husky/",
  ".github/workflows/",
  "tooling/guard/",
  "tooling/eslint/",
];

const PROTECTED_FILES: readonly string[] = [
  ".claude/settings.json",
  ".lintstagedrc.json",
  "commitlint.config.ts",
  "eslint.config.ts",
  "knip.json",
  "package.json",
  "pnpm-workspace.yaml",
  "typedoc.json",
  "vitest.config.ts",
];

// A tsconfig anywhere can turn off strict type checking.
const TSCONFIG = /(?:^|\/)tsconfig[^/]*\.json$/;

/**
 * Tells whether a file is part of the hard-rule enforcement.
 *
 * @param relativePath - Path from the repository root, with `/` separators.
 * @returns `true` when changing the file needs the user's approval.
 */
export function isProtectedPath(relativePath: string): boolean {
  return (
    PROTECTED_FILES.includes(relativePath) ||
    PROTECTED_DIRS.some((dir) => relativePath.startsWith(dir)) ||
    TSCONFIG.test(relativePath)
  );
}

/**
 * Tells whether a path is, or may contain, a protected file.
 *
 * @remarks Used for shell commands, where a directory such as `tooling` can be deleted or restored as a whole.
 * Any directory might hold a tsconfig, so only directories known to hold none are treated as safe.
 * @param relativePath - Path from the repository root, with `/` separators and no trailing slash.
 * @returns `true` when writing to the path could change a protected file.
 */
export function coversProtectedPath(relativePath: string): boolean {
  if (relativePath === "." || relativePath === "") return true;
  if (isProtectedPath(relativePath) || isProtectedPath(`${relativePath}/`)) return true;
  const prefix = `${relativePath}/`;
  return (
    PROTECTED_DIRS.some((dir) => dir.startsWith(prefix)) ||
    PROTECTED_FILES.some((file) => file.startsWith(prefix)) ||
    isPackageRoot(relativePath)
  );
}

// A package root holds its own tsconfig.json.
function isPackageRoot(relativePath: string): boolean {
  return /^(?:packages|apps)\/[^/]+$/.test(relativePath);
}
