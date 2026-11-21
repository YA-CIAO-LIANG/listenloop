import { defineConfig } from "vitest/config";

/**
 * Runs scripts/chat-eval-record.record.ts (D197), which may call the
 * paid API: only through `npm run eval:chat:record`, never with the test
 * suite, and without tests/setup-network.ts.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["scripts/chat-eval-record.record.ts"],
    environment: "node",
    testTimeout: 1_800_000,
  },
});
