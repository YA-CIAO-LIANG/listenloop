import { expect, signInAsLearner, signInAsPaid, test } from "./fixtures";

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

test("after AI writes and translates, an instruction revises it and undo brings it back (D96)", async ({
  page,
}) => {
  await signInAsLearner(page);
  await page.goto("/materials/new");
  await page.getByText("AI 生成").click();
  await page.getByRole("button", { name: "生成文字" }).click();
  await expect(page.getByLabel("文字內容")).not.toHaveValue("");
  await page.getByRole("button", { name: "斷句並翻譯" }).click();
  await expect(page.getByLabel("第 1 句英文")).toBeVisible();
  const before = await page.getByLabel(/第 \d+ 句英文/).count();
  expect(before).toBeGreaterThan(2);

  // The fake provider keeps the first N for "N 句".
  await page.getByLabel("修改指令").fill("縮短成 2 句");
  await page.getByRole("button", { name: "修改", exact: true }).click();
  await expect(page.getByText(/已修改：2 句中有 0 句變動/)).toBeVisible();
  await expect(page.getByLabel(/第 \d+ 句英文/)).toHaveCount(2);

  await page.getByRole("button", { name: "復原上一步" }).click();
  await expect(page.getByLabel(/第 \d+ 句英文/)).toHaveCount(before);
});

test("a YouTube link and its transcript become timed sentences to review (D97)", async ({
  page,
}) => {
  await signInAsPaid(page);
  await page.goto("/materials/new");
  await page.getByText("YouTube 連結").click();
  await page
    .getByLabel("YouTube 影片連結")
    .fill("https://www.youtube.com/watch?v=ccVideo0001");
  await page.getByRole("button", { name: "讀取影片" }).click();
  await expect(page.getByText("Open Lecture: How Sleep Works")).toBeVisible();
  await expect(page.getByText(/可以設為公開/)).toBeVisible();
  await page
    .getByLabel("字幕記錄（含時間）")
    .fill("0:01\nso how does\n0:03\nsleep work?\n0:05\nLet's find out.");
  await page.getByRole("button", { name: /斷句並翻譯/ }).click();
  await expect(
    page.getByText("so how does sleep work?", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("0:01–0:04")).toBeVisible();
  await expect(page.getByLabel("第 2 句中文")).not.toHaveValue("");
});

test("on the free plan, YouTube practices are a paid feature (D97)", async ({
  page,
}) => {
  await signInAsLearner(page);
  await page.goto("/materials/new");
  await page.getByText("YouTube 連結").click();
  await expect(page.getByLabel("YouTube 影片連結")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /看方案/ })).toHaveAttribute(
    "href",
    "/pricing?from=youtube",
  );
});
