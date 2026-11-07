import { describe, expect, it } from "vitest";
import { errorEntry } from "@/lib/error-log";

/** Server errors, logged without personal details (D63). */
describe("errorEntry", () => {
  it("drops the query string and masks email addresses", () => {
    const error = Object.assign(new Error("No user joe@example.com"), {
      digest: "12345",
    });
    const entry = errorEntry(
      error,
      { path: "/account?token=secret", method: "GET" },
      { routeType: "render" },
    );
    expect(entry).toMatchObject({
      digest: "12345",
      message: "No user <email>",
      path: "/account",
      method: "GET",
      route_type: "render",
    });
    expect(entry.stack).not.toContain("joe@example.com");
  });

  it("handles things thrown that aren't errors", () => {
    expect(errorEntry("boom", {}, {})).toMatchObject({
      message: "boom",
      path: null,
      digest: null,
    });
  });
});
