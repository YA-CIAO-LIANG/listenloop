import { defineConfig } from "vitest/config";

/**
 * Runs scripts/writing-audio.record.ts (D195), which calls Azure Speech
 * (F0): only through `npm run writing:audio`, never with the test suite,
 * and without tests/setup-network.ts.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["scripts/writing-audio.record.ts"],
    environment: "node",
    testTimeout: 3_600_000,
  },
});
