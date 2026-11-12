import AxeBuilder from "@axe-core/playwright";
import mock from "./mock-supabase/practices.json";
import { expect, setToday, signInAsAuthor, test } from "./fixtures";

/**
 * Listening mode (D135): locked until Day 1 is done, then the whole text
 * with the subtitles chosen (remembered), the three passes, and a way in
 * from today's tasks.
 */
const practice = mock.ready;
const id = `p-${practice.id}`;

test("listening mode opens after Day 1, from today's tasks", async ({
  page,
}) => {
  await setToday(page, "2026-11-01");
  await signInAsAuthor(page);

  await page.goto(`/videos/${id}/listen`);
  await expect(page.getByText(/完成第 1 天的聽寫後/)).toBeVisible();

  // Day 1, with one word misheard.
  await page.goto(`/videos/${id}/day/1`);
  const input = page.getByRole("textbox", { name: "你聽到的句子" });
  for (const [i, sentence] of practice.practice_sentences.entries()) {
    await input.fill(
      i === 0 ? sentence.en.replace("left", "right") : sentence.en,
    );
    await page.getByRole("button", { name: "送出" }).click();
    const last = i === practice.practice_sentences.length - 1;
    await page
      .getByRole("button", { name: last ? "查看結果" : "下一句" })
      .click();
  }
  await page.getByRole("link", { name: "聆聽模式" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/videos/${id}/listen$`));

  // Both languages at first, the misheard word highlighted.
  await expect(page.getByText(practice.practice_sentences[0].zh)).toBeVisible();
  await expect(page.locator("mark").first()).toContainText("left");

  // Blind, remembered after a reload.
  await page.getByText("盲聽", { exact: true }).click();
  await expect(page.getByText(practice.practice_sentences[0].zh)).toHaveCount(
    0,
  );
  await page.reload();
  await expect(page.getByRole("radio", { name: "盲聽" })).toBeChecked();
  await expect(page.getByText("第 1 句", { exact: true })).toBeVisible();

  // The three passes start blind.
  await page.getByRole("button", { name: "三遍聽法" }).click();
  await expect(page.getByText(/第 1 遍／共 3 遍/)).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  // Today's tasks link to it now.
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: /^聆聽模式：/ }).first(),
  ).toHaveAttribute("href", `/videos/${id}/listen`);
});
