import { describe, expect, it } from "vitest";
import { isAdminEmail, parseAdminEmails } from "@/lib/admin";

describe("admin emails", () => {
  it("parses a comma-separated list, trimmed and lowercased", () => {
    expect(parseAdminEmails(" Joe@Example.com, ,b@x.io ")).toEqual(
      new Set(["joe@example.com", "b@x.io"]),
    );
  });

  it("matches case-insensitively", () => {
    expect(isAdminEmail("JOE@example.com", "joe@example.com")).toBe(true);
    expect(isAdminEmail("other@example.com", "joe@example.com")).toBe(false);
  });

  it.each([
    [undefined, "joe@example.com"],
    ["", "joe@example.com"],
    ["joe@example.com", undefined],
    ["joe@example.com", ""],
  ])("has no admins for email %j and list %j", (email, list) => {
    expect(isAdminEmail(email, list)).toBe(false);
  });
});
