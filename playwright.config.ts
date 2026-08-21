import { defineConfig, devices } from "@playwright/test";

/**
 * E2E mínimo. Rode com: npm run test:e2e
 * Requer app em http://localhost:9002 (npm run dev) ou use webServer abaixo.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:9002",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Descomente se quiser o Playwright subir o dev server sozinho:
  // webServer: {
  //   command: "npm run dev",
  //   url: "http://127.0.0.1:9002",
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
});
