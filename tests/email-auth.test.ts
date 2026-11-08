import { describe, expect, it, vi } from "vitest";
import { lineAuthorizeUrl, lineIdentity } from "@/auth/line";
import { passwordProblem, passwordStrength } from "@/lib/auth/password";
import { parseSignInResult } from "@/lib/auth/redirect";

describe("password rules (D101)", () => {
  it("wants 10 characters, any kind, and not a common one", () => {
    expect(passwordProblem("short")).toBe("short");
    expect(passwordProblem("1234567890")).toBe("common");
    expect(passwordProblem("aaaaaaaaaaaa")).toBe("common");
    expect(passwordProblem("joe.chen.2026!", "joe.chen@example.com")).toBe(
      "email",
    );
    expect(passwordProblem("我每天早上練習聽力英文")).toBeNull();
    expect(passwordProblem("correct horse battery")).toBeNull();
    expect(passwordProblem("x".repeat(80) + "y")).toBe("long");
  });

  it("rates strength by length and variety", () => {
    expect(passwordStrength("1234567890")).toBe("weak");
    expect(passwordStrength("tea-and-toast")).toBe("fair");
    expect(passwordStrength("Tea-and-Toast-7")).toBe("strong");
    expect(passwordStrength("a long passphrase here")).toBe("strong");
  });

  it("knows the LINE no-email result", () => {
    expect(parseSignInResult("noEmail")).toBe("noEmail");
  });
});

describe("LINE Login (D101)", () => {
  const config = { channelId: "123", secret: "s3cret" };

  it("asks LINE for openid, profile, and email with state and nonce", () => {
    const url = new URL(
      lineAuthorizeUrl("123", "https://x.dev/auth/line/callback", "st", "no"),
    );
    expect(url.origin + url.pathname).toBe(
      "https://access.line.me/oauth2/v2.1/authorize",
    );
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: "code",
      client_id: "123",
      state: "st",
      nonce: "no",
      scope: "openid profile email",
    });
  });

  it("swaps the code and has LINE verify the id_token with our nonce", async () => {
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      const body = new URLSearchParams(String(init.body));
      if (url.endsWith("/token")) {
        expect(body.get("client_secret")).toBe("s3cret");
        return new Response(JSON.stringify({ id_token: "jwt" }));
      }
      expect(body.get("id_token")).toBe("jwt");
      expect(body.get("nonce")).toBe("n1");
      return new Response(
        JSON.stringify({
          sub: "U1",
          email: "Joe@Example.com",
          name: "Joe",
          nonce: "n1",
        }),
      );
    });
    expect(
      await lineIdentity(
        "code",
        "https://x.dev/cb",
        "n1",
        config,
        fetchImpl as unknown as typeof fetch,
      ),
    ).toEqual({ sub: "U1", email: "joe@example.com", name: "Joe" });
  });

  it("refuses a failed exchange or a different nonce", async () => {
    const bad = vi.fn(async () => new Response("no", { status: 400 }));
    expect(
      await lineIdentity("c", "u", "n", config, bad as unknown as typeof fetch),
    ).toBeNull();
    const other = vi.fn(async (url: string) =>
      url.endsWith("/token")
        ? new Response(JSON.stringify({ id_token: "jwt" }))
        : new Response(JSON.stringify({ sub: "U1", nonce: "other" })),
    );
    expect(
      await lineIdentity(
        "c",
        "u",
        "n",
        config,
        other as unknown as typeof fetch,
      ),
    ).toBeNull();
  });
});
