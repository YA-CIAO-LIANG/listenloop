import { defineConfig } from "vitest/config";

/**
 * Runs scripts/ai-record.record.ts, the one place that may call the paid
 * APIs (CLAUDE.md, "AI 供應者與測試"): only through `npm run ai:record`,
 * never with the test suite, and without tests/setup-network.ts.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["scripts/ai-record.record.ts"],
    environment: "node",
    testTimeout: 180_000,
  },
});
