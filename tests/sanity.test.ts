import { describe, expect, it } from "vitest";
import packageJson from "@/package.json";

// Verifies the test runner and the "@/" path alias are wired up.
describe("test setup", () => {
  it("resolves the @/ path alias", () => {
    expect(packageJson.name).toBe("listenloop");
  });
});
