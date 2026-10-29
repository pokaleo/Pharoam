import { defineConfig } from "vitest/config";

const EXCLUDE = ["**/node_modules/**", "**/__fixtures__/**"];

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: "node",
          include: ["packages/*/src/**/*.test.ts", "tooling/**/*.test.ts"],
          exclude: EXCLUDE,
        },
      },
      // The web app's tests run in a browser-like DOM, with the app's own Vite config (aliases, plugins).
      // Its build helpers run in Node, as Vite runs them.
      {
        extends: "./apps/web/vite.config.ts",
        test: {
          name: "web",
          include: ["apps/web/src/**/*.test.{ts,tsx}"],
          exclude: [...EXCLUDE, "apps/web/src/build/**"],
          environment: "jsdom",
          setupFiles: ["apps/web/src/__fixtures__/setup.ts"],
        },
      },
      {
        extends: "./apps/web/vite.config.ts",
        test: { name: "web-build", include: ["apps/web/src/build/**/*.test.ts"], exclude: EXCLUDE },
      },
    ],
    // Only with `--coverage` (`pnpm test:coverage`), so a single test file can still run on its own (ENGINEERING §4).
    coverage: {
      provider: "v8",
      include: ["packages/core/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/__fixtures__/**"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
