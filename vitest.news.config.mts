import { defineConfig } from "vitest/config";

/**
 * Runs scripts/news.record.ts (D100), which reads news feeds and calls
 * the paid APIs: only through `npm run news:make`, never with the test
 * suite, and without tests/setup-network.ts.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["scripts/news.record.ts"],
    environment: "node",
    testTimeout: 3_600_000,
  },
});
