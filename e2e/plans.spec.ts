import AxeBuilder from "@axe-core/playwright";
import { expect, signInAsAdmin, signInAsAuthor, test } from "./fixtures";

/** Plans (D72): past the free trial, the paid plan and its waiting list. */
test("past the free trial, the create page offers the paid plan's waitlist", async ({
  page,
}) => {
  await signInAsAuthor(page);
  await page.goto("/materials/new");
  const card = page.getByRole("region", { name: "Plus 方案" });
  await expect(card).toContainText("免費方案可以試做 1 份自己的教材");
  await expect(card).toContainText("每月自建 40 分鐘的教材");
  await expect(card).toContainText("每份最長 5 分鐘");
  await expect(card).toContainText(
    "NT$124／月年繳 NT$1,490，一次付清，省 2 個月",
  );
  // No creating form, so no paid call can start.
  await expect(page.getByRole("button", { name: /斷句/ })).toHaveCount(0);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  await card.getByRole("button", { name: "加入等候名單" }).click();
  await expect(card).toContainText("已加入等候名單");
  await page.reload();
  await expect(card).toContainText("已加入等候名單");
  await expect(card.getByRole("button", { name: "加入等候名單" })).toHaveCount(
    0,
  );
});

test("admins create without limits", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/materials/new");
  await expect(page.getByRole("heading", { name: "付費方案" })).toHaveCount(0);
});
