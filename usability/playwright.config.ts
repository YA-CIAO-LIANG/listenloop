import { defineConfig, devices } from "@playwright/test";
import base from "../playwright.config";

/**
 * The AI usability test (docs/usability-ai-test.md, skill
 * ai-usability-test): walks the main tasks as each persona would, on a
 * phone (375 px, touch) and a laptop (1280 px), against the E2E build
 * and the stand-in Supabase, with the fake AI and payment providers.
 * Screenshots and measurements land in usability-results/ (not kept in
 * git); Claude reads them and writes the report.
 *
 *   npm run build:e2e && npm run usability -- --round 1
 */
export default defineConfig({
  ...base,
  // The servers run from the project root, as in the E2E tests.
  webServer: [base.webServer ?? []]
    .flat()
    .map((server) => ({ ...server, cwd: ".." })),
  testDir: ".",
  outputDir: "../usability-results/artifacts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  projects: [
    {
      name: "phone",
      use: {
        ...devices["iPhone 13"],
        viewport: { width: 375, height: 812 },
        browserName: "chromium",
      },
    },
    {
      name: "laptop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
