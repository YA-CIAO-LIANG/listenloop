import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  signInAsAdmin,
  signInAsAuthor,
  signInAsLearner,
  test,
} from "./fixtures";

/**
 * Plans (D72, D143): past the free plan's minutes this week, when they
 * come back, the paid plan and its waiting list.
 */
test("past this week's free minutes, the create page offers the paid plan's waitlist", async ({
  page,
}) => {
  await signInAsAuthor(page);
  await page.goto("/materials/new");
  await expect(page.getByTestId("week-allowance")).toContainText(
    /本週的已經用完，\d+\/\d+（週一）\s?00:00 重設/,
  );
  const card = page.getByRole("region", { name: "Plus 方案" });
  await expect(card).toContainText(
    "免費方案每週可以建立 2 分鐘的教材，本週已經用完。",
  );
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
  await expect(page.getByTestId("week-allowance")).toHaveCount(0);
});

test("a free learner sees the week's minutes left and when they reset (D143)", async ({
  page,
}) => {
  await signInAsLearner(page);
  await page.goto("/materials/new");
  await expect(page.getByTestId("week-allowance")).toContainText(
    /每週可以建立 2 分鐘.*本週還剩 2 分鐘，\d+\/\d+（週一）\s?00:00 重設/,
  );
  await expect(page.getByRole("button", { name: /斷句/ })).toBeVisible();
});
