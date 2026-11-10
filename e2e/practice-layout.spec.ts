import mock from "./mock-supabase/practices.json";
import { expect, signInAsAuthor, test } from "./fixtures";

/**
 * Where the practice buttons are (D124): the main action on the right,
 * in the same place for every sentence; on phones in a bar fixed to the
 * bottom of the screen.
 */
const id = `p-${mock.ready.id}`;

test("on a phone, Submit and Next sit in the same bottom bar for every sentence", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await signInAsAuthor(page);
  await page.goto(`/videos/${id}/day/1`);
  const input = page.getByRole("textbox");
  // Hands-free (D125): the first tap starts the sound, in the same place.
  const start = page.getByRole("button", { name: "開始練習" });
  await expect(start).toBeVisible();
  const first = await start.boundingBox();
  // In the bottom bar, on the right, where the thumb is.
  expect(first!.y + first!.height).toBeGreaterThan(740 - 80);
  expect(first!.x + first!.width).toBeGreaterThan(375 - 40);

  await input.fill("The station is on the left.");
  await input.press("Enter");
  const next = await page.getByRole("button", { name: "下一句" }).boundingBox();
  expect(next!.y).toBeCloseTo(first!.y, 0);
  expect(next!.x + next!.width).toBeCloseTo(first!.x + first!.width, 0);
  await page.getByRole("button", { name: "下一句" }).click();
  await input.fill("The");
  const again = await page.getByRole("button", { name: "送出" }).boundingBox();
  expect(again!.y).toBeCloseTo(first!.y, 0);
  // The bar never hides the last line of the page.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByRole("contentinfo")).toBeInViewport();
});

test("on a laptop, the main button is on the right, below the answer, and doesn't move", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signInAsAuthor(page);
  await page.goto(`/videos/${id}/day/1`);
  const input = page.getByRole("textbox");
  const box = await input.boundingBox();
  const submit = await page
    .getByRole("button", { name: "開始練習" })
    .boundingBox();
  expect(submit!.y).toBeGreaterThan(box!.y + box!.height);
  expect(submit!.x + submit!.width).toBeCloseTo(box!.x + box!.width, 0);

  await input.fill("The station is on the left.");
  await input.press("Enter");
  const next = await page.getByRole("button", { name: "下一句" }).boundingBox();
  expect(next!.x + next!.width).toBeCloseTo(submit!.x + submit!.width, 0);
  expect(next!.y).toBeCloseTo(submit!.y, 0);
  // Reporting is a visible button at the top of the notes.
  const report = page.getByRole("button", { name: "回報這句的問題" });
  await expect(report).toBeVisible();
  const notes = await page
    .getByRole("region", { name: "這句的講解" })
    .boundingBox();
  const reportBox = await report.boundingBox();
  expect(reportBox!.y).toBeLessThan(notes!.y + 80);
});

test("hands-free starts with one tap and can be turned off on the page (D125)", async ({
  page,
}) => {
  await signInAsAuthor(page);
  await page.goto(`/videos/${id}/day/1`);
  await expect(page.getByText(/按「開始練習」後自動播放/)).toBeVisible();
  await page.getByRole("button", { name: "開始練習" }).click();
  await expect(page.getByRole("button", { name: "暫停" })).toBeVisible();
  await expect(page.getByRole("textbox")).toBeFocused();
  await page.getByRole("checkbox", { name: /免手動練習/ }).uncheck();
  await expect(page.getByRole("button", { name: "暫停" })).toHaveCount(0);
  await page.reload();
  // Remembered on this device: no start button any more.
  await expect(page.getByRole("button", { name: "送出" })).toBeVisible();
  await expect(page.getByRole("button", { name: "開始練習" })).toHaveCount(0);
});
