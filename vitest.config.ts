import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

const EXCLUDE = ["**/node_modules/**", "**/__fixtures__/**"];

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        // LangChain's tracing package is replaced here too, as in the built app, so a tracing setting in the shell
        // sends nothing from a test (hard rule 7). LangChain's packages are inlined so the replacement reaches them.
        resolve: {
          alias: [
            {
              find: /^langsmith(?:\/.*)?$/,
              replacement: join(import.meta.dirname, "apps/web/src/ai/langsmith-stand-in.ts"),
            },
          ],
        },
        test: {
          name: "node",
          include: ["packages/*/src/**/*.test.ts", "tooling/**/*.test.ts"],
          exclude: EXCLUDE,
          server: { deps: { inline: [/@langchain\//] } },
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
          // Page tests render whole screens and run axe, so on a busy machine they can pass 5 seconds without
          // anything being wrong; the pre-push check then fails on load, not on the code.
          testTimeout: 15_000,
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
      // Each run writes its report to its own folder. Two agents' Stop hooks can run `pnpm check` at once, and
      // Vitest refuses a second run on a report folder another run is using. The OS temp folder clears old reports.
      reportsDirectory: join(tmpdir(), "pharoam-coverage", String(process.pid)),
      include: ["packages/core/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/__fixtures__/**"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
