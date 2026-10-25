import { describe, expect, it } from "vitest";
import { findUntestedSources } from "./tdd.ts";

const existing = (files: string[]) => (path: string) => files.includes(path);

describe("TDD check: changed source files come with tests", () => {
  it("flags a source file without a test", () => {
    expect(findUntestedSources(["packages/core/src/profile.ts"], existing([]))).toEqual([
      "packages/core/src/profile.ts",
    ]);
  });

  it("accepts a source file whose test changed in the same commit", () => {
    expect(
      findUntestedSources(
        ["packages/core/src/profile.ts", "packages/core/src/profile.test.ts"],
        existing([]),
      ),
    ).toEqual([]);
  });

  it("accepts a source file that already has a test", () => {
    expect(
      findUntestedSources(["apps/web/src/ui/Button.tsx"], existing(["apps/web/src/ui/Button.test.tsx"])),
    ).toEqual([]);
  });

  it.each([
    "packages/core/src/index.ts",
    "packages/core/src/types.d.ts",
    "docs/PRD.md",
    "tooling/eslint/boundaries.js",
    "packages/core/package.json",
    "packages/core/src/__fixtures__/sample.ts",
  ])("ignores %s", (path) => {
    expect(findUntestedSources([path], existing([]))).toEqual([]);
  });
});
