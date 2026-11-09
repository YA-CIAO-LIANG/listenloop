import { defineConfig } from "vitest/config";

/**
 * Runs scripts/blender-drafts.record.ts (D118), which may call the paid
 * language model: only through `npm run blender:drafts`, never with the
 * test suite.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["scripts/blender-drafts.record.ts"],
    environment: "node",
    testTimeout: 3_600_000,
  },
});
