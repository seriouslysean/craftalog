import { defineConfig, devices } from "@playwright/test";

// E2E smoke tests run against the production build: `astro preview` serves
// dist/, so `npm run build` must have run before `npm run test:e2e`.
//
// A dedicated port rather than Astro's default 4321: `reuseExistingServer`
// trusts whatever answers on the port, so any other project's dev/preview
// server squatting on the default would get tested instead of this site.
const PORT = 43210;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
  },
});
