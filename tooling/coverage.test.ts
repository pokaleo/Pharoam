import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import config from "../vitest.config.ts";

// The core holds the logic every rule depends on, so CI fails when its coverage drops below 90% (ENGINEERING §4).
const repoRoot = path.join(import.meta.dirname, "..");
const read = (file: string): string => readFileSync(path.join(repoRoot, file), "utf8");

describe("core coverage", () => {
  const coverage = config.test?.coverage;

  it("measures only the core's source, not its tests", () => {
    expect(coverage).toMatchObject({
      provider: "v8",
      include: ["packages/core/src/**/*.ts"],
      exclude: ["**/*.test.ts"],
    });
  });

  it("requires at least 90% on every measure", () => {
    expect(coverage?.thresholds).toEqual({ lines: 90, functions: 90, branches: 90, statements: 90 });
  });

  it("runs in pnpm check and in CI", () => {
    const { scripts } = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(scripts["test:coverage"]).toBe("vitest run --coverage");
    expect(scripts.check).toContain("pnpm test:coverage");
    expect(read(".github/workflows/ci.yml")).toMatch(/^\s+run: pnpm test:coverage$/m);
  });
});
