import { defineConfig } from "vitest/config";

// Scopes Vitest to the unit-test tree so it never collects e2e/*.spec.ts
// (those are Playwright tests, run via `npm run test:e2e`).
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
