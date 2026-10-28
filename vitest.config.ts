import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["{packages,apps}/*/src/**/*.test.{ts,tsx}", "tooling/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/__fixtures__/**"],
    passWithNoTests: true,
    // Only with `--coverage` (`pnpm test:coverage`), so a single test file can still run on its own (ENGINEERING §4).
    coverage: {
      provider: "v8",
      include: ["packages/core/src/**/*.ts"],
      exclude: ["**/*.test.ts"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
