import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({
  configured: true,
  exchangeCodeForSession: vi.fn(),
}));
vi.mock("@/auth/server", () => ({
  getServerSupabase: async () =>
    supabase.configured
      ? { auth: { exchangeCodeForSession: supabase.exchangeCodeForSession } }
      : null,
}));

const { GET } = await import("@/app/auth/callback/route");

const callback = async (query: string) => {
  const response = await GET(
    new NextRequest(`https://listenloop.test/auth/callback?${query}`),
  );
  return response.headers.get("location");
};

beforeEach(() => {
  supabase.configured = true;
  supabase.exchangeCodeForSession.mockReset();
});

describe("/auth/callback", () => {
  it("swaps the code for a session and returns to the page", async () => {
    supabase.exchangeCodeForSession.mockResolvedValue({ error: null });
    expect(await callback("code=abc&next=%2Fvideos%2Fsintel")).toBe(
      "https://listenloop.test/videos/sintel",
    );
    expect(supabase.exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });

  it("marks a cancelled sign-in", async () => {
    expect(await callback("error=access_denied&next=%2F%3Flength%3D1-2")).toBe(
      "https://listenloop.test/?length=1-2&signin=cancelled",
    );
    expect(supabase.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("marks other errors, a missing code, and a failed swap as failed", async () => {
    expect(await callback("error=server_error")).toBe(
      "https://listenloop.test/?signin=failed",
    );
    expect(await callback("next=%2Fvideos%2Fsintel")).toBe(
      "https://listenloop.test/videos/sintel?signin=failed",
    );
    supabase.exchangeCodeForSession.mockResolvedValue({
      error: new Error("expired"),
    });
    expect(await callback("code=old")).toBe(
      "https://listenloop.test/?signin=failed",
    );
  });

  it("never redirects off the site", async () => {
    supabase.exchangeCodeForSession.mockResolvedValue({ error: null });
    expect(await callback("code=abc&next=https%3A%2F%2Fevil.example")).toBe(
      "https://listenloop.test/",
    );
    expect(await callback("code=abc&next=%2F%2Fevil.example")).toBe(
      "https://listenloop.test/",
    );
  });

  it("fails softly when accounts aren't configured", async () => {
    supabase.configured = false;
    expect(await callback("code=abc")).toBe(
      "https://listenloop.test/?signin=failed",
    );
  });
});
