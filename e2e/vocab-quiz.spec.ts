import AxeBuilder from "@axe-core/playwright";
import sintel from "../data/videos/sintel.json";
import {
  misheardWords,
  pickQuizWords,
  quizCandidates,
} from "../lib/vocab-quiz";
import { expect, setToday, signInAsAuthor, test } from "./fixtures";

/**
 * Day 1 → listening mode → the vocabulary quiz's two steps → a missed
 * word on the review list the next day (D135, D136). The words' sound
 * is the browser's voice here (the stand-in keeps no files).
 */
test("after Day 1: listen, take the quiz, and review what was missed", async ({
  page,
}) => {
  await signInAsAuthor(page);
  await setToday(page, "2026-11-01");
  await page.goto("/videos/sintel/day/1");

  // Day 1, with "unprepared" misheard.
  const answers = sintel.sentences.map((s) =>
    s.i === 2 ? s.en.replace("unprepared", "prepared") : s.en,
  );
  const input = page.getByRole("textbox", { name: "你聽到的句子" });
  for (const [i, answer] of answers.entries()) {
    await input.fill(answer);
    await page.getByRole("button", { name: "送出" }).click();
    const last = i === answers.length - 1;
    await page
      .getByRole("button", { name: last ? "查看結果" : "下一句" })
      .click();
  }

  // Listening mode is open now.
  await page.getByRole("link", { name: "聆聽模式" }).first().click();
  await page.getByText("只有英文", { exact: true }).click();
  await expect(page.getByText(sintel.sentences[0].zh)).toHaveCount(0);
  await expect(page.getByText(sintel.sentences[0].en)).toBeVisible();
  await page.goBack();

  // The quiz, from the result page.
  await expect(page.getByText("單字測驗（約 3 分鐘）")).toBeVisible();
  await page.getByRole("link", { name: /開始測驗/ }).click();
  await expect(page).toHaveURL(/\/videos\/sintel\/quiz$/);

  const words = pickQuizWords(
    quizCandidates(sintel),
    misheardWords(sintel.sentences, answers),
  );
  expect(words[0].word).toBe("unprepared");
  for (const [i, word] of words.entries()) {
    await expect(
      page.getByText(`第 ${i + 1} 個／共 ${words.length} 個`),
    ).toBeVisible();
    // Step 1: the second word is misspelled.
    await page
      .getByLabel("你聽到的單字")
      .fill(i === 1 ? word.word.slice(1) : word.word);
    await page.getByRole("button", { name: "送出" }).click();
    await expect(page.getByText(i === 1 ? /拼錯了/ : "拼對了！")).toBeVisible();
    if (i === 0) {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(results.violations.map((v) => v.id)).toEqual([]);
    }
    await page.getByRole("button", { name: /下一關/ }).click();
    // Step 2: the first word gets the wrong meaning.
    const choices = page.getByRole("group", { name: /這個字的中文意思/ });
    await expect(choices.getByRole("radio")).toHaveCount(4);
    if (i === 0) {
      const labels = await choices.locator("label").allInnerTexts();
      const wrong = labels.find((text) => text.trim() !== word.zh)!;
      await choices.getByLabel(wrong.trim()).check();
    } else {
      await choices.getByLabel(word.zh, { exact: true }).check();
    }
    await page.getByRole("button", { name: "送出" }).click();
    await page
      .getByRole("button", {
        name: i === words.length - 1 ? "看結果" : "下一個單字",
      })
      .click();
  }

  await expect(page.getByRole("heading", { name: "測驗結果" })).toBeVisible();
  await expect(
    page.getByText(`${words.length - 1} / ${words.length}`),
  ).toHaveCount(2);
  await expect(page.getByText(/2 個字已加入錯字複習/)).toBeVisible();

  // The next day, both missed words wait on the review list.
  await setToday(page, "2026-11-02");
  await page.goto("/review");
  await expect(page.getByText(/第 1 個，共 2 個/)).toBeVisible();
});
