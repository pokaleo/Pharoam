import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["{packages,apps}/*/src/**/*.test.{ts,tsx}", "tooling/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/__fixtures__/**"],
    passWithNoTests: true,
  },
});
