import { defineConfig } from "vitest/config";

/**
 * Runs scripts/official-audit.record.ts (D115), which reads the official
 * materials and may call the paid language model: only through
 * `npm run official:audit`, never with the test suite.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["scripts/official-audit.record.ts"],
    environment: "node",
    testTimeout: 3_600_000,
  },
});
