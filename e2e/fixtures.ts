import { test as base, type Page } from "@playwright/test";

/**
 * Pages with YouTube blocked (deterministic, offline) and Chinese UI.
 * `provide` is Playwright's fixture callback, usually called `use`; renamed
 * so the React hooks lint rule doesn't mistake it for React's use().
 */
export const test = base.extend({
  page: async ({ page, context }, provide) => {
    await context.addCookies([
      { name: "ll-locale", value: "zh-Hant", url: "http://localhost:3200" },
    ]);
    await page.route(
      /youtube(-nocookie)?\.com|ytimg\.com|googlevideo\.com/,
      (route) => route.abort(),
    );
    await provide(page);
  },
});

export { expect } from "@playwright/test";

/** Sets the page clock to a local date (Asia/Taipei), 10:00. */
export async function setToday(page: Page, date: string) {
  await page.clock.setFixedTime(new Date(`${date}T10:00:00+08:00`));
}

/**
 * Signs in as the author of the practices in e2e/mock-supabase/: a
 * session cookie the stand-in accepts. Progress on the home page and
 * /practices shows only when signed in (D2).
 */
export async function signInAsAuthor(page: Page) {
  await signInAs(page, { id: "e2e-author", email: "author@example.com" });
}

/**
 * Signs in as an admin (D56): the stand-in reports role "admin" for this
 * account's profile. No secret key in E2E, so admin pages show their
 * empty or "no key" states: enough to see each page renders.
 */
export async function signInAsAdmin(page: Page) {
  await signInAs(page, { id: "e2e-admin", email: "admin@example.com" });
}

/**
 * Signs in as a learner on the free plan who hasn't made a practice yet
 * (D72): the one-practice trial is still open.
 */
export async function signInAsLearner(page: Page) {
  await signInAs(page, { id: "e2e-learner", email: "learner@example.com" });
}

/** Signs in as an account on the paid plan (paid features such as D97). */
export async function signInAsPaid(page: Page) {
  await signInAs(page, { id: "e2e-paid", email: "paid@example.com" });
}

/**
 * Signs in as an account of its own for the payment flow (D85), so its
 * paid plan never changes what other tests see.
 */
export async function signInAsBuyer(page: Page, id = "e2e-buyer") {
  await signInAs(page, { id, email: `${id}@example.com` });
}

/** Signs in as any account (e.g. one with a long Gmail address). */
export async function signInWithEmail(page: Page, id: string, email: string) {
  await signInAs(page, { id, email });
}

async function signInAs(page: Page, user: { id: string; email: string }) {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = 4_102_444_800; // 2100
  const accessToken = [
    base64url({ alg: "HS256", typ: "JWT" }),
    base64url({
      sub: user.id,
      email: user.email,
      aud: "authenticated",
      role: "authenticated",
      exp: expiresAt,
    }),
    base64url("signature"),
  ].join(".");
  const session = {
    access_token: accessToken,
    refresh_token: "refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: { ...user, aud: "authenticated", role: "authenticated" },
  };
  await page.context().addCookies([
    {
      name: "sb-localhost-auth-token",
      value: `base64-${base64url(session)}`,
      url: "http://localhost:3200",
    },
  ]);
}
