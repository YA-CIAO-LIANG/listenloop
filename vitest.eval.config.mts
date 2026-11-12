import { defineConfig } from "vitest/config";

/**
 * Runs scripts/eval.eval.ts (D150): scores the golden set from its
 * recordings, never calling an API (tests/setup-network.ts blocks the
 * paid hosts). `npm run eval` writes the baseline and report;
 * `npm run eval:check` is CI's gate.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["scripts/eval.eval.ts"],
    environment: "node",
    setupFiles: ["tests/setup-network.ts"],
    testTimeout: 120_000,
  },
});
