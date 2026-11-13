import { expect, signInAsAdmin, test } from "./fixtures";

/** The Day 7 survey's answers on the admin's feedback page (D164). */
test("the admin sees the survey's score and comments", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/feedback");
  await expect(
    page.getByRole("heading", { name: "第 7 天滿意度調查" }),
  ).toBeVisible();
  await expect(page.getByText("NPS", { exact: true })).toBeVisible();
  await expect(page.getByText("第 7 天看到進步很有成就感")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "頁尾的意見回饋" }),
  ).toBeVisible();
});
