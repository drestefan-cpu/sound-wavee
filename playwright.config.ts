import { defineConfig, devices } from "@playwright/test";

/**
 * Browser checks: build PLAI, serve it locally, and open the main pages in a phone-sized browser.
 * Run with:  npm run test:browser
 * (Signed-out pages use http://[::1]; localhost gets PLAI's built-in local test account.)
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { ...devices["iPhone 13"], browserName: "chromium", trace: "retain-on-failure" },
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort --host ::",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
