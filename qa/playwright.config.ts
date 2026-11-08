import { defineConfig, devices } from "@playwright/test";
import base from "../playwright.config";

/**
 * The QA sweep (docs/qa-log.md, skill qa-sweep): every page at 360, 375,
 * 414, 768, and 1280 px, light and dark, Chinese and English, against the
 * E2E build and the stand-in Supabase (fake AI and payment providers).
 * Findings land in qa-results/ (not kept in git).
 *
 *   npm run build:e2e && QA_ROUND=1 npm run qa
 *
 * QA_BASE_URL=https://listenloop-three.vercel.app sweeps the live site
 * instead (signed-out pages only; nothing is written).
 */
const live = process.env.QA_BASE_URL;

export default defineConfig({
  ...base,
  webServer: live
    ? undefined
    : [base.webServer ?? []].flat().map((server) => ({ ...server, cwd: ".." })),
  testDir: ".",
  outputDir: "../qa-results/artifacts",
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: "line",
  use: { ...base.use, ...(live ? { baseURL: live } : {}) },
  projects: [{ name: "sweep", use: { ...devices["Desktop Chrome"] } }],
});
