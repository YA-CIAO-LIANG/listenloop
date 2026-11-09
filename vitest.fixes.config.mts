import { defineConfig } from "vitest/config";

/**
 * Runs scripts/content-fixes.record.ts (D117), which reads the published
 * official materials and stores suggested fixes for an admin to review:
 * only through `npm run content:fixes`, never with the test suite. No AI.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["scripts/content-fixes.record.ts"],
    environment: "node",
    testTimeout: 600_000,
  },
});
