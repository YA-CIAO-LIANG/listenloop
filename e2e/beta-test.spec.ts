import { expect, signInAsAdmin, test } from "./fixtures";

/** The admin's Beta test page (D165): progress and who to follow up. */
test("the admin sees each tester's progress and who needs a nudge", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin");
  await page.getByRole("link", { name: "Beta 測試" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Beta 測試", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("第 1 週第 3 天（1 份教材）")).toBeVisible();
  await expect(page.getByText(/\d+ 天沒有練習/)).toBeVisible();
  await expect(page.getByText(/加入 \d+ 天，還沒完成第 1 天/)).toBeVisible();
  await expect(page.getByText("第 3 天訪談")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "第 7 天滿意度調查" }),
  ).toBeVisible();
});
