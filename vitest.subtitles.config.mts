import { defineConfig } from "vitest/config";

/**
 * Runs scripts/subtitles.record.ts (D71), which calls the paid APIs:
 * only through `npm run subtitles:record`, never with the test suite, and
 * without tests/setup-network.ts.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["scripts/subtitles.record.ts"],
    environment: "node",
    testTimeout: 3_600_000,
  },
});
