import { describe, expect, it } from "vitest";
import { withoutTrailingSlash } from "@/lib/trailing-slash";

describe("withoutTrailingSlash (D174, ZAP 10019)", () => {
  it("drops trailing slashes", () => {
    expect(withoutTrailingSlash("/r/")).toBe("/r");
    expect(withoutTrailingSlash("/videos/sintel/")).toBe("/videos/sintel");
    expect(withoutTrailingSlash("//")).toBe("/");
  });

  it("leaves the home page and paths without one alone", () => {
    expect(withoutTrailingSlash("/")).toBeNull();
    expect(withoutTrailingSlash("/pricing")).toBeNull();
  });
});
