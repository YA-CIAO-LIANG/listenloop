import { expect, signInAsLearner, test } from "./fixtures";

/**
 * Writing practice text with AI (D81), with the fake provider: a
 * scenario of one's own, and a title that's never changed.
 */
test("a learner's own title is kept exactly, with a scenario of their own", async ({
  page,
}) => {
  await signInAsLearner(page);
  await page.goto("/materials/new");
  await page.getByText("AI 生成").click();
  await page
    .getByLabel("情境", { exact: true })
    .selectOption({ label: "（不選，只用自訂情境）" });
  await expect(page.getByLabel("自訂情境（必填）")).toBeVisible();
  await page.getByLabel("自訂情境（必填）").fill("跟教授請病假並詢問補交作業");
  const title = "  請病假：寫給 Prof. Lee 的訊息  ";
  await page.getByLabel("標題（選填）").fill(title);
  await page.getByRole("button", { name: "生成文字" }).click();
  // Back on the text form: the title as typed (ends trimmed), editable.
  const field = page.getByLabel("標題", { exact: true });
  await expect(field).toHaveValue(title.trim());
  await expect(page.getByLabel("文字內容")).not.toHaveValue("");
});
