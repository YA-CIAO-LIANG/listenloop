import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // lib/ holds pure logic; switch per-file to jsdom when component tests arrive (M1).
    environment: "node",
    include: ["tests/**/*.test.ts", "lib/**/*.test.ts"],
  },
});
