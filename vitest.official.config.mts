import { defineConfig } from "vitest/config";

/**
 * Runs scripts/official-drafts.record.ts (D59), which calls the paid
 * APIs: only through `npm run official:drafts`, never with the test
 * suite, and without tests/setup-network.ts.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["scripts/official-drafts.record.ts"],
    environment: "node",
    testTimeout: 3_600_000,
  },
});
