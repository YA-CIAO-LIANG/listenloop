import AxeBuilder from "@axe-core/playwright";
import { devices } from "@playwright/test";
import mock from "./mock-supabase/practices.json";
import { expect, signInAsAuthor, signInAsLearner, test } from "./fixtures";

/**
 * My materials as folders (D147): every signed-in account (not only
 * admins), folders to create, open, rename, and delete, materials moved
 * by "Move to" or by dragging, grid or list, a breadcrumb back.
 */
const title = mock.ready.title;
const unique = () => `資料夾 ${Math.random().toString(36).slice(2, 7)}`;

test("a learner without materials sees the empty state, not 'unavailable'", async ({
  page,
}) => {
  await signInAsLearner(page);
  await page.goto("/materials");
  await expect(page.getByText("建立練習暫時無法使用")).toHaveCount(0);
  await expect(page.getByText("還沒有自己的教材。")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "建立教材" }).first(),
  ).toHaveAttribute("href", "/materials/new");
});

test("folders: create, move into, open, list view, rename, delete", async ({
  page,
}) => {
  await signInAsAuthor(page);
  await page.goto("/materials");
  const name = unique();
  await page.getByRole("button", { name: "新增資料夾" }).click();
  await page.getByLabel("資料夾名稱").fill(name);
  await page.getByRole("button", { name: "建立", exact: true }).click();
  const tile = page.getByRole("link", { name: new RegExp(name) });
  await expect(tile).toContainText("0 份");

  // An empty folder says so and offers to create.
  await tile.click();
  await expect(page).toHaveURL(/folder=f-/);
  const crumbs = page.getByRole("navigation", { name: "目前位置" });
  await expect(crumbs).toContainText(`我的教材›${name}`);
  await expect(page.getByText("這個資料夾還是空的")).toBeVisible();
  await crumbs.getByRole("link", { name: "我的教材" }).click();

  // Move to: the material goes into the folder.
  const item = page.getByRole("article").filter({ hasText: title });
  await item.getByLabel("移動到").selectOption({ label: name });
  await expect(tile).toContainText("1 份");
  await tile.click();
  await expect(
    page.getByRole("article").filter({ hasText: title }),
  ).toBeVisible();

  // List view, remembered.
  await page.getByText("清單", { exact: true }).click();
  await page.reload();
  await expect(page.getByRole("radio", { name: "清單" })).toBeChecked();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  // Rename, then delete: the material goes back to the top.
  await page.getByRole("button", { name: "重新命名" }).click();
  await page.getByLabel("資料夾名稱").fill(`${name}!`);
  await page.getByRole("button", { name: "儲存" }).click();
  await expect(crumbs).toContainText(`${name}!`);
  await page.getByRole("button", { name: "刪除資料夾" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "刪除資料夾" })
    .click();
  await expect(page).toHaveURL(/\/materials$/);
  await expect(
    page
      .getByRole("region", { name: "還沒放進資料夾的教材" })
      .getByRole("article")
      .filter({ hasText: title }),
  ).toBeVisible();
});

test("dragging a material onto a folder moves it (mouse)", async ({ page }) => {
  await signInAsAuthor(page);
  await page.goto("/materials");
  const name = unique();
  await page.getByRole("button", { name: "新增資料夾" }).click();
  await page.getByLabel("資料夾名稱").fill(name);
  await page.getByRole("button", { name: "建立", exact: true }).click();
  const tile = page.getByRole("link", { name: new RegExp(name) });
  await expect(tile).toBeVisible();
  await page
    .getByRole("article")
    .filter({ hasText: mock.unfinished.title })
    // From the card's edge, not its "Move to" menu.
    .dragTo(tile, { sourcePosition: { x: 6, y: 6 } });
  await expect(tile).toContainText("1 份");
  // Clean up: deleting the folder puts it back.
  await tile.click();
  await page.getByRole("button", { name: "刪除資料夾" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "刪除資料夾" })
    .click();
  await expect(page).toHaveURL(/\/materials$/);
});

test.describe("on a phone", () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { defaultBrowserType, ...pixel } = devices["Pixel 7"];
  test.use(pixel);

  test("'Move to' is there for every material, and nothing is wider than the screen", async ({
    page,
  }) => {
    await signInAsAuthor(page);
    await page.goto("/materials");
    await expect(
      page.getByRole("article").first().getByLabel("移動到"),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
});
