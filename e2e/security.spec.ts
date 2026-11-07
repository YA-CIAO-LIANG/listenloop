import { expect, signInAsAuthor, test } from "./fixtures";

/**
 * Security headers (D63): every page has a CSP with a fresh nonce, and
 * the pages run without a single CSP violation, signed out and in.
 */
test("pages send the security headers and a per-request nonce", async ({
  page,
}) => {
  const first = await page.goto("/");
  const second = await page.goto("/");
  const csp = (r: typeof first) =>
    r?.headers()["content-security-policy"] ?? "";
  expect(csp(first)).toContain("'strict-dynamic'");
  expect(csp(first)).toContain("frame-ancestors 'none'");
  const nonce = (policy: string) => /'nonce-([^']+)'/.exec(policy)?.[1];
  expect(nonce(csp(first))).toBeTruthy();
  expect(nonce(csp(first))).not.toBe(nonce(csp(second)));
  const headers = second?.headers() ?? {};
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["permissions-policy"]).toContain("microphone=(self)");
});

test("main pages run without CSP violations", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to/.test(message.text())) {
      violations.push(message.text());
    }
  });
  await signInAsAuthor(page);
  for (const path of [
    "/",
    "/explore",
    "/videos/sintel",
    "/videos/sintel/day/1",
    "/practices",
    "/account",
    "/terms",
  ]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  expect(violations).toEqual([]);
});
