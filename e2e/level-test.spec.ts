import mock from "./mock-supabase/practices.json";
import { expect, test } from "./fixtures";

/** The level test (D109), signed out, from the home page. */
test("the level test suggests a level and a first material", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: "不確定從哪裡開始？做 2 分鐘程度測驗" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "程度測驗" }),
  ).toBeVisible();
  // The rule is said before starting (D146).
  await expect(page.getByText(/正確率達到 60% 就算達到那一級/)).toBeVisible();
  await page.getByRole("button", { name: "開始測驗" }).click();
  await expect(page.getByText("第 1 句，共 1 句")).toBeVisible();
  const field = page.getByLabel("你聽到的句子");
  await expect(field).toBeFocused();
  await field.fill("can I see your passport please");
  await field.press("Enter");

  await expect(page.getByText("建議的程度")).toBeVisible();
  await expect(page.getByText("100%")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "從推薦的第一份開始" }),
  ).toHaveAttribute("href", `/videos/p-${mock.official.id}`);
  await expect(
    page.getByRole("link", { name: "看所有「初級」教材" }),
  ).toHaveAttribute("href", "/?level=beginner#library");

  // Remembered on this device.
  await page.reload();
  await expect(page.getByText("上次的結果：初級")).toBeVisible();

  // The starting level: the library opens filtered to it (D146).
  await page.goto("/");
  await expect(page).toHaveURL(/level=beginner/);
});
