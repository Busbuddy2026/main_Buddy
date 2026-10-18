import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end flows (README §11). They run against a second dev server on
 * port 3100 that talks to the test database (DATABASE_URL_TEST), seeded with
 * the demo data: `npm run db:test:deploy && npm run db:seed:demo` once.
 * The real database the portal shows is never touched. Fixtures are built
 * through the admin API, so no reset is needed between runs.
 */
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev:test",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
