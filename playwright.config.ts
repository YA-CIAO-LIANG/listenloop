import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

/**
 * End-to-end tests (e2e/) against the production build: run `npm run
 * build:e2e` first, then `npm run test:e2e`. YouTube is blocked in the
 * tests (e2e/fixtures.ts) so they don't depend on the network, and the
 * build talks to a stand-in Supabase (e2e/mock-supabase/, D32) instead of
 * the real project. The app always uses the fake AI providers here, with
 * every API key blanked, so no test can reach a paid API (CLAUDE.md).
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "zh-TW",
    timezoneId: "Asia/Taipei",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/mock-supabase/server.mts",
      url: "http://localhost:54329/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npx next start --port ${PORT}`,
      port: PORT,
      // Set here, these win over .env.local.
      env: {
        AI_PROVIDERS: "fake",
        AZURE_SPEECH_KEY: "",
        AZURE_OPENAI_API_KEY: "",
        GEMINI_API_KEY: "",
        GOOGLE_CLOUD_API_KEY: "",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
