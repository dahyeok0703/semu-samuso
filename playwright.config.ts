import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e config.
 *
 * Requires a running app + a TEST Supabase project. For the full signup→
 * onboarding flow the test project MUST have email confirmation DISABLED
 * (Supabase Auth → "Confirm email" off, or local `enable_confirmations = false`)
 * so signup creates a session immediately. See docs/deployment.md.
 *
 * Run:  pnpm test:e2e        (starts `next dev` automatically)
 *       E2E_BASE_URL=https://staging.example pnpm test:e2e   (against a deploy)
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const useExternal = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: useExternal
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
