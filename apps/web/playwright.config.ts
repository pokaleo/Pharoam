import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against the production build, with its content security policy, in Chromium: the browsers
// v0.1 supports (MVP §3, ENGINEERING §4).
const PORT = 4318;
const ci = process.env.CI !== undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: ci,
  reporter: ci ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://localhost:${String(PORT)}/`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm build && pnpm exec vite preview --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}/`,
    reuseExistingServer: !ci,
    timeout: 120_000,
  },
});
