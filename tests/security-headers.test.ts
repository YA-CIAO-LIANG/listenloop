import { describe, expect, it } from "vitest";
import {
  contentSecurityPolicy,
  createNonce,
  SECURITY_HEADERS,
} from "@/lib/security/csp";

/** Security headers (D63). */
const directives = (policy: string) =>
  new Map(
    policy.split("; ").map((d) => {
      const [name, ...values] = d.split(" ");
      return [name, values] as const;
    }),
  );

describe("contentSecurityPolicy", () => {
  const policy = contentSecurityPolicy({
    nonce: "abc123",
    supabaseUrl: "https://project.supabase.co",
  });
  const map = directives(policy);

  it("runs only this request's scripts, and what they load", () => {
    expect(map.get("script-src")).toEqual([
      "'self'",
      "'nonce-abc123'",
      "'strict-dynamic'",
      "https://www.youtube.com",
      "https://s.ytimg.com",
    ]);
    expect(map.get("object-src")).toEqual(["'none'"]);
    expect(map.get("frame-ancestors")).toEqual(["'none'"]);
    expect(policy).not.toContain("unsafe-eval");
  });

  it("allows the YouTube player and Supabase, nothing else outside", () => {
    expect(map.get("frame-src")).toEqual([
      "https://www.youtube-nocookie.com",
      "https://www.youtube.com",
    ]);
    expect(map.get("connect-src")).toEqual([
      "'self'",
      "https://project.supabase.co",
      "wss://project.supabase.co",
    ]);
    expect(map.get("media-src")).toContain("https://project.supabase.co");
    expect(map.has("upgrade-insecure-requests")).toBe(true);
  });

  it("allows eval only in development, and keeps a local Supabase on http", () => {
    const dev = contentSecurityPolicy({
      nonce: "n",
      supabaseUrl: "http://localhost:54329",
      development: true,
    });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
    const e2e = contentSecurityPolicy({
      nonce: "n",
      supabaseUrl: "http://localhost:54329",
    });
    expect(e2e).not.toContain("upgrade-insecure-requests");
  });
});

describe("createNonce", () => {
  it("is fresh each time", () => {
    expect(createNonce()).not.toBe(createNonce());
    expect(createNonce()).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});

describe("SECURITY_HEADERS", () => {
  it("allows only the microphone among powerful features", () => {
    const permissions = SECURITY_HEADERS.find(
      (h) => h.key === "Permissions-Policy",
    )?.value;
    expect(permissions).toContain("microphone=(self)");
    expect(permissions).toContain("camera=()");
  });
});
