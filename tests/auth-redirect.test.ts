import { describe, expect, it } from "vitest";
import {
  parseSignInResult,
  safeNextPath,
  withSignInResult,
} from "@/lib/auth/redirect";

describe("safeNextPath", () => {
  it.each([
    ["/videos/sintel", "/videos/sintel"],
    ["/?length=1-2", "/?length=1-2"],
    ["/videos/sintel/day/1#top", "/videos/sintel/day/1#top"],
  ])("keeps the site path %s", (value, expected) => {
    expect(safeNextPath(value)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "videos",
    "https://evil.example/",
    "//evil.example/path",
    "/\\evil.example",
    "javascript:alert(1)",
  ])("sends %j home instead of off the site", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });

  it("drops an old sign-in result", () => {
    expect(safeNextPath("/?signin=failed&length=1-2")).toBe("/?length=1-2");
  });
});

describe("withSignInResult", () => {
  it("adds the result to the path, keeping its query", () => {
    expect(withSignInResult("/?length=1-2", "cancelled")).toBe(
      "/?length=1-2&signin=cancelled",
    );
    expect(withSignInResult("https://evil.example", "failed")).toBe(
      "/?signin=failed",
    );
  });
});

describe("parseSignInResult", () => {
  it("reads known results only", () => {
    expect(parseSignInResult("failed")).toBe("failed");
    expect(parseSignInResult("cancelled")).toBe("cancelled");
    expect(parseSignInResult("ok")).toBeNull();
    expect(parseSignInResult(null)).toBeNull();
  });
});
