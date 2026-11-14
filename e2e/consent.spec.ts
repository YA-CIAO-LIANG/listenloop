import { expect, signInWithEmail, test } from "./fixtures";

/**
 * The analytics cookie notice is asked once (D180): signed in, the choice
 * is kept in the account, so a new browser doesn't ask again, and the
 * account page can change it. It only shows when Clarity is set up, so
 * this runs on a build made with NEXT_PUBLIC_CLARITY_PROJECT_ID (the QA
 * sweep's consent round); the usual build skips it.
 */
test.skip(
  !process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID,
  "needs a build with NEXT_PUBLIC_CLARITY_PROJECT_ID",
);

test("a signed-in choice follows the account to a new browser", async ({
  page,
  browser,
}) => {
  const who = `e2e-consent-${Math.random().toString(36).slice(2, 8)}`;
  // Block Clarity itself; only the notice is under test.
  await page.route("https://*.clarity.ms/**", (route) => route.abort());
  await signInWithEmail(page, who, `${who}@example.com`);
  await page.goto("/");
  const notice = page.getByRole("region", { name: "Cookie 設定" });
  await notice.getByRole("button", { name: "只用必要的 Cookie" }).click();
  await expect(notice).toHaveCount(0);
  await page.goto("/practices");
  await expect(notice).toHaveCount(0);

  // Another browser, same account: not asked.
  const other = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    locale: "zh-TW",
  });
  const second = await other.newPage();
  await signInWithEmail(second, who, `${who}@example.com`);
  await second.goto("/");
  await expect(second.getByRole("contentinfo")).toBeVisible();
  await expect(second.getByRole("region", { name: "Cookie 設定" })).toHaveCount(
    0,
  );

  // The account page shows it and can ask again.
  await second.goto("/account");
  await expect(second.getByText("目前：只用必要的 Cookie")).toBeVisible();
  await second.getByRole("button", { name: "更改 Cookie 設定" }).click();
  await expect(
    second.getByRole("region", { name: "Cookie 設定" }),
  ).toBeVisible();
  await other.close();
});
