import { devices } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * The Android app (Trusted Web Activity, D178), emulated: a Pixel 7
 * whose first page has the app as its referrer, as Android opens it.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...pixel7 } = devices["Pixel 7"];
test.use(pixel7);

const APP_REFERRER = "android-app://app.listenloop.twa/";

test.beforeEach(async ({ page }) => {
  // Android sets the referrer only on the page it opens; Chromium drops
  // a non-web referrer from page.goto, so the first page gets it here.
  await page.addInitScript((referrer) => {
    if (sessionStorage.getItem("ll-twa-e2e-opened")) return;
    sessionStorage.setItem("ll-twa-e2e-opened", "1");
    Object.defineProperty(Document.prototype, "referrer", {
      get: () => referrer,
    });
  }, APP_REFERRER);
});

test("the site vouches for the app with JSON, without redirects", async ({
  request,
}) => {
  const response = await request.get("/.well-known/assetlinks.json", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  // TWA_PACKAGE_NAME and TWA_SHA256_FINGERPRINTS aren't set in E2E.
  expect(await response.json()).toEqual([]);
});

test("inside the app, pages know it for the whole session", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-twa", "");
  // A later page has no app referrer; the session remembers.
  await page.goto("/videos/sintel");
  await expect(page.locator("html")).toHaveAttribute("data-twa", "");
});

test("Android's back button goes back through the practice", async ({
  page,
}) => {
  await page.goto("/");
  await page.goto("/videos/sintel");
  await page.locator('a[href="/videos/sintel/day/1"]').first().click();
  await expect(page).toHaveURL(/\/videos\/sintel\/day\/1$/);
  // Back is history: day 1 → the video page → home, never out of the app.
  await page.goBack();
  await expect(page).toHaveURL(/\/videos\/sintel$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test("other sites open in a new tab (a Custom Tab in the app)", async ({
  page,
}) => {
  await page.goto("/videos/sintel");
  const external = page.locator('main a[href^="http"]');
  expect(await external.count()).toBeGreaterThan(0);
  for (const link of await external.all()) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  }
});

test("Google sign-in comes back to the app's own origin", async ({
  page,
  baseURL,
}) => {
  let authorize: URL | null = null;
  // The stand-in Supabase has no Google: catch the hand-off instead.
  await page.route(/\/auth\/v1\/authorize/, async (route) => {
    authorize = new URL(route.request().url());
    await route.fulfill({ status: 204 });
  });
  await page.goto("/login?next=%2Fpractices");
  await page.getByRole("button", { name: "用 Google 登入" }).click();
  await expect.poll(() => authorize).not.toBeNull();
  const redirect = new URL(authorize!.searchParams.get("redirect_to")!);
  expect(redirect.origin).toBe(new URL(baseURL!).origin);
  expect(redirect.pathname).toBe("/auth/callback");
  // A path on this site (the callback sends /login on to its next).
  expect(redirect.searchParams.get("next")).toMatch(/^\/.*practices/);
});
