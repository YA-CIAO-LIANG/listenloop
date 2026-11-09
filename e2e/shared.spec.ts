import mock from "./mock-supabase/practices.json";
import {
  expect,
  setToday,
  signInAsLearner,
  signInAsPaid,
  test,
} from "./fixtures";

/**
 * Shared materials are for paying plans (D106): /explore lists only what
 * people shared; free accounts and signed-out visitors get a preview, and
 * the practice pages send them back to it; Plus and Pro practice in full.
 */
const shared = `p-${mock.shared.id}`;

test("signed out, /explore lists shared materials but no official ones", async ({
  page,
}) => {
  await page.goto("/explore");
  await expect(page.getByText("E2E shared practice")).toBeVisible();
  await expect(page.getByText("E2E official practice")).toHaveCount(0);
});

test("on the free plan, a shared material is a preview with an upgrade", async ({
  page,
}) => {
  await signInAsLearner(page);
  await page.goto(`/videos/${shared}`);
  await expect(page.getByText("公開教材預覽")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: /E2E shared practice/ }),
  ).toBeVisible();
  await expect(page.getByText("在餐廳帶位和點餐。")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "前 3 句（共 5 句）" }),
  ).toBeVisible();
  // The first three sentences in English and Chinese, and no more.
  await expect(page.getByText("Could I get a table for two?")).toBeVisible();
  await expect(page.getByText("這是你們的菜單。")).toBeVisible();
  await expect(page.getByText("Are you ready to order?")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "試聽第 1 句" })).toBeVisible();
  // No way into the practice from here.
  await expect(page.getByRole("link", { name: /第 1 天/ })).toHaveCount(0);

  await page.getByRole("link", { name: "升級即可練習這份教材" }).click();
  await expect(page).toHaveURL(/\/pricing\?from=shared-preview$/);
});

test("on the free plan, a practice or handout address goes to the preview", async ({
  page,
}) => {
  await signInAsLearner(page);
  for (const path of ["day/1", "day/3", "handout"]) {
    await page.goto(`/videos/${shared}/${path}`);
    await expect(page).toHaveURL(new RegExp(`/videos/${shared}$`));
    await expect(page.getByText("公開教材預覽")).toBeVisible();
  }
});

test("signed out, a shared material is a preview too", async ({ page }) => {
  await page.goto(`/videos/${shared}/day/1`);
  await expect(page).toHaveURL(new RegExp(`/videos/${shared}$`));
  await expect(
    page.getByRole("link", { name: "升級即可練習這份教材" }),
  ).toBeVisible();
});

test("on Plus, a shared material can be practiced in full", async ({
  page,
}) => {
  await signInAsPaid(page);
  await setToday(page, "2026-11-10");
  await page.goto(`/videos/${shared}`);
  await expect(page.getByText("公開教材預覽")).toHaveCount(0);
  await page.goto(`/videos/${shared}/day/1`);
  await expect(
    page.getByRole("heading", { name: /第 1 天：精聽聽寫/ }),
  ).toBeVisible();
});
