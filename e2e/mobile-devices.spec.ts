import { devices, type Page } from "@playwright/test";
import {
  expect,
  signInAsAdmin,
  signInAsLearner,
  signInAsPaid,
  signInWithEmail,
  test,
} from "./fixtures";

/**
 * Phones, emulated as the real devices (D140): their screen, touch, and
 * mobile browser's user agent. Every page is laid out at the phone's own
 * width for every kind of visitor, and coming back from signing in lands
 * on a phone layout too.
 */
const PAGES = [
  "/",
  "/login",
  "/materials",
  "/materials/new",
  "/practices",
  "/stats",
  "/account",
  "/review",
  "/pricing",
  "/explore",
  "/videos/sintel",
  "/videos/sintel/day/1",
  "/videos/sintel/listen",
];

/** Pages wider than the screen (a phone would zoom out, like a desktop). */
async function tooWide(page: Page, paths: readonly string[]) {
  const wide: string[] = [];
  for (const path of paths) {
    await page.goto(path);
    const m = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
      viewport: document
        .querySelector('meta[name="viewport"]')
        ?.getAttribute("content"),
    }));
    if (m.scroll > m.inner + 1 || !m.viewport?.includes("device-width")) {
      wide.push(`${path}: ${m.scroll} > ${m.inner} (${m.viewport})`);
    }
  }
  return wide;
}

const ROLES: [string, ((page: Page) => Promise<void>) | null][] = [
  ["visitor", null],
  ["free", signInAsLearner],
  ["paid", signInAsPaid],
  ["admin", signInAsAdmin],
  // A real Gmail address can be long and unbreakable.
  [
    "long email",
    (page) =>
      signInWithEmail(page, "e2e-long", "learner1234567890abcdefg@example.com"),
  ],
];

for (const name of ["iPhone 15", "Pixel 7"] as const) {
  test.describe(name, () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { defaultBrowserType, ...device } = devices[name];
    test.use(device);

    for (const [role, signIn] of ROLES) {
      test(`${role}: every page fits the phone`, async ({ page }) => {
        expect(await page.evaluate(() => navigator.userAgent)).toMatch(
          /iPhone|Android/,
        );
        if (signIn) await signIn(page);
        expect(await tooWide(page, PAGES)).toEqual([]);
      });
    }

    test("coming back from signing in lands on a phone layout", async ({
      page,
    }) => {
      await page.goto("/login?next=%2Fpractices");
      // Google sends the learner back to /auth/callback, which goes on to
      // the page they started from, now signed in.
      await signInAsLearner(page);
      await page.goto("/auth/callback?error=access_denied&next=%2Fpractices");
      await expect(page).toHaveURL(/\/practices\?signin=cancelled$/);
      expect(await tooWide(page, ["/practices", "/"])).toEqual([]);
      expect(await page.evaluate(() => window.innerWidth)).toBeLessThan(500);
    });
  });
}
