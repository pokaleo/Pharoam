import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against the production build, with its content security policy, in the browsers v0.1
// supports (MVP §3, ENGINEERING §4).
const PORT = 4318;
const ci = process.env.CI !== undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: ci,
  // A shared runner can stall a journey past its limit, as the WebKit folder copy did twice while passing in a few
  // seconds alone. One retry tells a stall from a failure: a journey that passes on retry is reported as flaky,
  // never silently, and one that fails twice fails the run. Locally, a failure is seen at once.
  retries: ci ? 1 : 0,
  reporter: ci ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://localhost:${String(PORT)}/`, trace: "retain-on-failure" },
  // Chromium keeps the profile in a folder; Safari's WebKit and Firefox keep it in the browser (ADR-0020).
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /browser-storage/ },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, testMatch: /browser-storage/ },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, testMatch: /browser-storage/ },
  ],
  webServer: {
    command: `pnpm build && pnpm exec vite preview --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}/`,
    reuseExistingServer: !ci,
    timeout: 120_000,
  },
});
