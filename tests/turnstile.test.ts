import { describe, expect, it, vi } from "vitest";
import { contentSecurityPolicy } from "@/lib/security/csp";
import { turnstileSiteKey } from "@/lib/turnstile";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }),
}));
const { verifyTurnstile } = await import("@/auth/turnstile");

/** Cloudflare Turnstile (D160). */
describe("verifyTurnstile", () => {
  const answer = (body: unknown, status = 200) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it("passes everything while the secret isn't set", async () => {
    expect(await verifyTurnstile(undefined, { secret: "" })).toBe(true);
  });

  it("needs a token Cloudflare accepts, sent with the visitor's IP", async () => {
    const ok = answer({ success: true });
    expect(
      await verifyTurnstile("tok", {
        secret: "s",
        fetchImpl: ok as unknown as typeof fetch,
      }),
    ).toBe(true);
    const sent = (ok.mock.calls[0] as unknown as [string, RequestInit])[1]
      .body as URLSearchParams;
    expect(sent.get("response")).toBe("tok");
    expect(sent.get("remoteip")).toBe("203.0.113.9");
    expect(
      await verifyTurnstile("tok", {
        secret: "s",
        fetchImpl: answer({ success: false }) as unknown as typeof fetch,
      }),
    ).toBe(false);
    expect(await verifyTurnstile("", { secret: "s" })).toBe(false);
    expect(await verifyTurnstile(42, { secret: "s" })).toBe(false);
  });

  it("lets people through when Cloudflare can't be reached", async () => {
    const down = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(
      await verifyTurnstile("tok", {
        secret: "s",
        fetchImpl: down as unknown as typeof fetch,
      }),
    ).toBe(true);
  });
});

describe("Turnstile settings", () => {
  it("is off without a site key", () => {
    expect(turnstileSiteKey("")).toBeNull();
    expect(turnstileSiteKey(" 0x4AAA ")).toBe("0x4AAA");
  });

  it("allows Cloudflare in the CSP only when it's set up", () => {
    const on = contentSecurityPolicy({
      nonce: "n",
      supabaseUrl: null,
      turnstile: true,
    });
    const off = contentSecurityPolicy({ nonce: "n", supabaseUrl: null });
    expect(on).toMatch(/frame-src [^;]*https:\/\/challenges\.cloudflare\.com/);
    expect(off).not.toContain("challenges.cloudflare.com");
  });
});
