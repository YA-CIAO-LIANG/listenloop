import { expect, signInAsAuthor, test } from "./fixtures";

/**
 * Practice reminders (D111): the account page offers them (the E2E build
 * has a test push key); permission is asked only when turned on.
 */
test("the account page offers daily reminders, off by default", async ({
  page,
}) => {
  // Headless Chromium always reports notifications as denied; a real
  // browser starts at "default" (not asked yet).
  await page.addInitScript(() =>
    Object.defineProperty(Notification, "permission", { get: () => "default" }),
  );
  await signInAsAuthor(page);
  await page.goto("/account");
  const section = page.getByRole("region", { name: "練習提醒" });
  await expect(section.getByText("提醒目前關閉。")).toBeVisible();
  await expect(section.getByLabel("提醒時間")).toHaveValue("20:00");
  await expect(section.getByRole("button", { name: "開啟提醒" })).toBeVisible();
});

test("blocked notifications say how to allow them", async ({ page }) => {
  await signInAsAuthor(page);
  await page.goto("/account");
  await expect(
    page
      .getByRole("region", { name: "練習提醒" })
      .getByText("通知已被封鎖。請在瀏覽器的網站設定裡允許通知，再回來開啟。"),
  ).toBeVisible();
});
