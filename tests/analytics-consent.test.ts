import { describe, expect, it } from "vitest";
import {
  clarityProjectId,
  isRecordedPath,
  parseConsent,
} from "@/lib/analytics-consent";
import { contentSecurityPolicy } from "@/lib/security/csp";

/** Real-user analytics (D148). */
describe("analytics consent", () => {
  it("is off without a project id, or with an odd one", () => {
    expect(clarityProjectId({})).toBeNull();
    expect(
      clarityProjectId({ NEXT_PUBLIC_CLARITY_PROJECT_ID: " " }),
    ).toBeNull();
    expect(
      clarityProjectId({ NEXT_PUBLIC_CLARITY_PROJECT_ID: "<script>" }),
    ).toBeNull();
    expect(
      clarityProjectId({ NEXT_PUBLIC_CLARITY_PROJECT_ID: " abc123xyz " }),
    ).toBe("abc123xyz");
  });

  it("reads only a real choice", () => {
    expect(parseConsent("granted")).toBe("granted");
    expect(parseConsent("denied")).toBe("denied");
    expect(parseConsent("yes")).toBeNull();
    expect(parseConsent(undefined)).toBeNull();
  });

  it("never records account, sign-in, class, or admin pages", () => {
    for (const path of [
      "/account",
      "/admin/usage",
      "/login",
      "/auth/callback",
      "/classroom/abc",
    ]) {
      expect(isRecordedPath(path), path).toBe(false);
    }
    for (const path of ["/", "/videos/sintel/day/1", "/accounting-tips"]) {
      expect(isRecordedPath(path), path).toBe(true);
    }
  });

  it("allows Clarity's hosts in the CSP only when it's set up", () => {
    const base = { nonce: "n", supabaseUrl: null };
    expect(contentSecurityPolicy(base)).not.toContain("clarity.ms");
    const policy = contentSecurityPolicy({ ...base, clarity: true });
    expect(policy).toMatch(/script-src [^;]*https:\/\/www\.clarity\.ms/);
    expect(policy).toMatch(/connect-src [^;]*https:\/\/\*\.clarity\.ms/);
  });
});
