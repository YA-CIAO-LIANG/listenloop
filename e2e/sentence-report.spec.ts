import mock from "./mock-supabase/practices.json";
import { expect, setToday, signInAsAuthor, test } from "./fixtures";

/** Reporting a problem with a sentence (D113), after answering it. */
const videoId = `p-${mock.ready.id}`;

test("a learner reports a wrong translation from the dictation notes", async ({
  page,
}) => {
  await signInAsAuthor(page);
  await setToday(page, "2026-11-01");
  await page.goto(`/videos/${videoId}/day/1`);
  const input = page.getByRole("textbox");
  await input.fill("The station is on the left.");
  await input.press("Enter");
  await page.getByRole("button", { name: "回報這句的問題" }).click();
  const dialog = page.getByRole("dialog", { name: "回報第 1 句的問題" });
  await expect(dialog.getByRole("button", { name: "送出回報" })).toBeDisabled();
  await dialog.getByLabel("翻譯錯誤").check();
  await dialog.getByLabel("補充說明（選填）").fill("應該是車站在左手邊");
  await dialog.getByRole("button", { name: "送出回報" }).click();
  await expect(
    page.getByText("已收到你的回報，謝謝！修正後會通知你。"),
  ).toBeVisible();
});
