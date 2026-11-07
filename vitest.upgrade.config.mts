import { defineConfig } from "vitest/config";

/**
 * Runs scripts/upgrade-notes.record.ts (D69), which calls the paid APIs:
 * only through `npm run notes:upgrade`, never with the test suite, and
 * without tests/setup-network.ts.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["scripts/upgrade-notes.record.ts"],
    environment: "node",
    testTimeout: 3_600_000,
  },
});
