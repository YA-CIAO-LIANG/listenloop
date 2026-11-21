import { describe, expect, it } from "vitest";
import { isOwnOrigin } from "@/lib/security/own-origin";
import { SITE_URL } from "@/lib/site";

describe("isOwnOrigin (D192)", () => {
  it("allows this site and local development only", () => {
    expect(isOwnOrigin(SITE_URL)).toBe(true);
    expect(isOwnOrigin("http://localhost:3200")).toBe(true);
    expect(isOwnOrigin("https://evil.example")).toBe(false);
    expect(isOwnOrigin("not a url")).toBe(false);
  });
});
