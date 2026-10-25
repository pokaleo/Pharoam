import { describe, expect, it } from "vitest";
import { coversProtectedPath, isProtectedPath } from "./protected.ts";

describe("protected enforcement files", () => {
  it.each([
    ".claude/settings.json",
    "tooling/guard/content-rules.ts",
    "tooling/guard/hooks/claude-pre-tool-use.ts",
    "tooling/eslint/boundaries.ts",
    "tooling/eslint/hard-rules.ts",
    "eslint.config.ts",
    "commitlint.config.ts",
    ".husky/pre-commit",
    ".lintstagedrc.json",
    ".github/workflows/ci.yml",
    "pnpm-workspace.yaml",
    "typedoc.json",
    "knip.json",
    "package.json",
    "tsconfig.json",
    "tsconfig.base.json",
    "packages/core/tsconfig.json",
    "vitest.config.ts",
  ])("protects %s", (path) => {
    expect(isProtectedPath(path)).toBe(true);
  });

  it.each([
    "packages/core/src/profile.ts",
    "packages/core/package.json",
    "docs/PRD.md",
    "AGENTS.md",
    ".claude/settings.local.json",
  ])("does not protect %s", (path) => {
    expect(isProtectedPath(path)).toBe(false);
  });
});

describe("paths that contain protected files", () => {
  it.each([".", "tooling", "tooling/eslint", ".github", ".husky", "packages/core"])("%s", (path) => {
    expect(coversProtectedPath(path)).toBe(true);
  });

  it.each(["packages", "docs", "node_modules", "apps/web/src"])("not %s", (path) => {
    expect(coversProtectedPath(path)).toBe(false);
  });
});
