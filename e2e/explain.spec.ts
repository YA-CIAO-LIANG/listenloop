import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import mock from "./mock-supabase/practices.json";
import { expect, test } from "./fixtures";

/**
 * Version 2 notes and the highlighter (D67, D68), on a created practice
 * whose second sentence has them (e2e/mock-supabase/practices.json).
 */
const id = `p-${mock.ready.id}`;

/** Answers sentence 1 right and sentence 2 with "bank" misheard. */
async function mishearSentence2(page: Page) {
  await page.goto(`/videos/${id}/day/1`);
  const input = page.getByRole("textbox");
  await input.fill("The station is on the left.");
  await input.press("Enter");
  await page.getByRole("button", { name: "下一句" }).click();
  await input.fill("turn right at the bench");
  await input.press("Enter");
}

test("Day 1 puts what was misheard first, highlighted", async ({ page }) => {
  await mishearSentence2(page);
  const mistakes = page
    .getByRole("heading", { name: "你這句聽錯的地方" })
    .locator("..");
  await expect(mistakes).toBeVisible();
  await expect(mistakes.locator("mark.mark-miss").first()).toHaveText(
    "你聽錯的字：bank",
  );
  // Version 2 details: difficulty, why it's hard to hear, IPA.
  await expect(page.getByText("難度：中等")).toBeVisible();
  await expect(page.getByText("聽起來像「rai-dat」")).toBeVisible();
  await expect(page.getByText("/tɝːn raɪt/")).toBeVisible();
});

test("the meaning sits right under the sentence, above the notes (D78)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mishearSentence2(page);
  const feedback = page.getByRole("status").filter({ hasText: "在銀行右轉。" });
  await expect(feedback).toBeVisible();
  const meaning = await feedback.getByText("在銀行右轉。").boundingBox();
  const notes = await page
    .getByRole("region", { name: "這句的講解" })
    .boundingBox();
  // Below the sentence and above the notes, in one column.
  expect(meaning && notes && meaning.y < notes.y).toBe(true);
  expect(meaning && notes && Math.abs(meaning.x - notes.x) < 40).toBe(true);
  await expect(page.getByText("在銀行右轉。")).toHaveCount(1);
});

for (const scheme of ["light", "dark"] as const) {
  test(`the highlighted notes pass axe (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await mishearSentence2(page);
    await expect(
      page.getByRole("heading", { name: "你這句聽錯的地方" }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude("iframe")
      .analyze();
    expect(
      results.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
      ),
    ).toEqual([]);
  });
}
