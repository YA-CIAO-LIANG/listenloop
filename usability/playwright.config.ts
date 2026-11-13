import { defineConfig, devices } from "@playwright/test";
import base from "../playwright.config";

/**
 * The AI usability test (docs/usability-ai-test.md, skill
 * ai-usability-test): walks whole flows as each persona would, on two
 * emulated phones (iPhone 15 and Pixel 7: screen, touch, and the phone's
 * user agent, in Chromium) and a laptop (1280 px), against the E2E build
 * and the stand-in Supabase, with the fake AI and payment providers.
 * Screenshots and measurements land in usability-results/ (not kept in
 * git); Claude reads them and writes the report (D170).
 *
 *   npm run build:e2e && USABILITY_ROUND=1 npm run usability
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType: _i, ...iphone } = devices["iPhone 15"];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType: _p, ...pixel } = devices["Pixel 7"];

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
  // A step that can't be done fails fast and is recorded, not waited on.
  use: { ...base.use, actionTimeout: 10_000 },
  projects: [
    { name: "iphone15", use: { ...iphone, browserName: "chromium" } },
    { name: "pixel7", use: { ...pixel, browserName: "chromium" } },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
