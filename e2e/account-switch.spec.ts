import {
  expect,
  setToday,
  signInAsAuthor,
  signInAsLearner,
  test,
} from "./fixtures";

/**
 * Signing out and in as someone else leaves nothing of the first
 * account on the device: no wallpaper, accent, filters, progress, or
 * review list (D138).
 */
test("after signing out, the next account sees none of the last one's things", async ({
  page,
}) => {
  await setToday(page, "2026-11-01");
  await signInAsAuthor(page);
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("ll-background", "ocean");
    localStorage.setItem("ll-accent", "teal");
    localStorage.setItem("ll-library-default:v1", "level=advanced");
    localStorage.setItem("ll-hands-free:v1", "off");
    localStorage.setItem(
      "ll-progress:v1:sintel",
      JSON.stringify({
        videoId: "sintel",
        week: 1,
        startedAt: "2026-10-31",
        days: { "1": { done: true, date: "2026-10-31", score: 0.5 } },
        status: "in-progress",
        history: [],
      }),
    );
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-bg", "ocean");

  await page.getByRole("button", { name: "帳號" }).click();
  await page.getByRole("button", { name: "登出" }).click();
  await expect(page.getByRole("link", { name: "登入" }).first()).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-bg", /.+/);
  const left = await page.evaluate(() =>
    Object.keys(localStorage).filter(
      (key) =>
        key.startsWith("ll-progress") ||
        [
          "ll-background",
          "ll-accent",
          "ll-library-default:v1",
          "ll-hands-free:v1",
          "ll-activity:v1",
          "ll-account:v1",
        ].includes(key),
    ),
  );
  expect(left).toEqual([]);

  // Someone else signs in on the same browser.
  await signInAsLearner(page);
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-bg", /.+/);
  await expect(page.locator("html")).not.toHaveAttribute("data-accent", /.+/);
  await page.goto("/practices");
  await expect(page.getByText("Sintel")).toHaveCount(0);
});
