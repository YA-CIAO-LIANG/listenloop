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
  // The title comes first (D82).
  const title = "  請病假：寫給 Prof. Lee 的訊息  ";
  await page.getByLabel("中文標題").fill(title);
  await page
    .getByLabel("情境", { exact: true })
    .selectOption({ label: "其他（自己描述）" });
  await page
    .getByLabel("想練什麼？（必填）")
    .fill("跟教授請病假並詢問補交作業");
  await page.getByRole("button", { name: "生成文字" }).click();
  // Back on the text form: the title as typed (ends trimmed), editable,
  // and the other language written in the same call (D83).
  await expect(page.getByLabel("中文標題")).toHaveValue(title.trim());
  await expect(page.getByLabel("英文標題")).not.toHaveValue("");
  await expect(page.getByLabel("文字內容")).not.toHaveValue("");
});

test("on a phone, the form reads top to bottom: title, source, what, how", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await signInAsLearner(page);
  await page.goto("/materials/new");
  await page.getByText("AI 生成").click();
  const top = async (label: string | RegExp) =>
    (await page
      .getByText(label, { exact: typeof label === "string" })
      .first()
      .boundingBox())!.y;
  const order = [
    await top("標題（選填）"),
    await top("文字來源"),
    await top("類別"),
    await top(/想練什麼/),
    await top("程度"),
    await top("形式"),
  ];
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
});
