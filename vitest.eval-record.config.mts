import { defineConfig } from "vitest/config";

/**
 * Runs scripts/eval-record.record.ts (D150), which may call the paid API
 * to record the golden set: only through `npm run eval:record`, never
 * with the test suite, and without tests/setup-network.ts.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["scripts/eval-record.record.ts"],
    environment: "node",
    testTimeout: 1_800_000,
  },
});
