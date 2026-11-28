import AxeBuilder from "@axe-core/playwright";
import { devices, type Page } from "@playwright/test";
import {
  checkBackAnswer,
  expect,
  setToday,
  signInAsAdmin,
  signInAsPaid,
  signInWithEmail,
  test,
} from "./fixtures";

/**
 * WritingLoop (D187): one prompt from Day 1 to Day 7 through the UI, as a
 * guest (scoring themselves), a free, a paid, and an admin account (AI
 * feedback from the fake provider), on a desktop and on two emulated
 * phones. One calendar day apart, like the real thing.
 */
const PROMPT = "daily-perfect-weekend";
const day = (n: number) => `2026-11-1${n}`;

/** Day 1: a few mistakes the fake reviewer finds, few linking words. */
const DAY1 =
  "My perfect weekend would start slowly. On Saturday he go to the park with me. We eat a apple and talk about school. i like it very much. My family would cook dinner together and we would watch a movie at home.";
/** Day 7: the same ideas, fixed, with linking words. */
const DAY7 =
  "My perfect weekend would start slowly. First, my brother goes to the park with me, and we eat an apple and talk about school. In addition, I like it very much because it is relaxing. Finally, my family would cook dinner together, and we would watch a movie at home.";

type Role = "guest" | "free" | "paid" | "admin";

async function signIn(page: Page, role: Role, device: string) {
  if (role === "free") {
    await signInWithEmail(
      page,
      `e2e-writer-${device}`,
      `writer-${device}@example.com`,
    );
  }
  if (role === "paid") await signInAsPaid(page);
  if (role === "admin") await signInAsAdmin(page);
}

async function writeEssay(
  page: Page,
  text: string,
  role: Role,
  better: boolean,
) {
  const box = page.getByRole("textbox", { name: "你的文章" });
  await expect(box).toBeEnabled();
  await box.fill(text);
  // The count and the button stay reachable (on phones, above the keyboard).
  await expect(page.getByRole("button", { name: /送出/ })).toBeInViewport();
  if (role === "admin") {
    // The stand-in's admin has used up today's AI (e2e/mock-supabase): the
    // limit is explained, and scoring it yourself still finishes the day.
    await page.getByRole("button", { name: "送出，取得 AI 回饋" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "今天的 AI 用量已經用完" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "改用評分標準自己評分" }).click();
  }
  if (role === "guest" || role === "admin") {
    if (role === "guest") {
      await page.getByRole("button", { name: "送出並自己評分" }).click();
    }
    await expect(
      page.getByRole("heading", { name: "用評分標準自己評分" }),
    ).toBeVisible();
    for (const select of await page.getByRole("combobox").all()) {
      await select.selectOption(better ? "4" : "2");
    }
    await page.getByRole("checkbox", { name: "連貫與轉折" }).check();
    await page.getByRole("button", { name: "完成評分" }).click();
    await expect(
      page.getByRole("heading", { name: "你的自評分數" }),
    ).toBeVisible();
  } else {
    await page.getByRole("button", { name: "送出，取得 AI 回饋" }).click();
    await expect(page.getByRole("heading", { name: "整體分數" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /最重要的 \d 個問題/ }),
    ).toBeVisible();
  }
}

/** Writes back each of the day's sentences until the day is done (D195). */
async function doDrills(page: Page) {
  const done = page.getByRole("heading", {
    name: "今天的練習完成了！明天再來。",
  });
  const box = page.getByRole("textbox", { name: "聽到的英文句子" });
  for (let step = 0; step < 10; step++) {
    await expect(box.or(done)).toBeVisible();
    if (await done.isVisible()) break;
    await box.fill("My perfect weekend would start slowly.");
    await checkBackAnswer(page);
    await page
      .getByRole("button", { name: /^(下一句|完成今天的練習)$/ })
      .click();
  }
  await expect(done).toBeVisible();
  await expect(page.getByText(/寫對 \d+／\d+ 句，平均正確率/)).toBeVisible();
}

async function wholeWeek(page: Page, role: Role, device: string) {
  test.setTimeout(120_000);
  await signIn(page, role, device);
  await setToday(page, day(1));
  await page.goto("/writing");
  await expect(
    page.getByRole("heading", { level: 1, name: "寫作練習" }),
  ).toBeVisible();
  // Listening | Writing: this is writing.
  await expect(
    page.getByRole("link", { name: "寫作", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: /My Perfect Weekend/ }).click();
  await expect(page).toHaveURL(new RegExp(`/writing/${PROMPT}$`));
  // Days 2–7 wait for Day 1.
  await expect(page.getByText("先完成前一天").first()).toBeVisible();
  await page.getByRole("link", { name: "開始第 1 天" }).click();

  // Day 1: the model stays hidden until the essay is in.
  await expect(page.getByRole("heading", { name: "範例文章" })).toHaveCount(0);
  await writeEssay(page, DAY1, role, false);
  // The model essay only when asked for (D218).
  await page.getByText("看範文").click();
  await expect(page.getByRole("heading", { name: "範例文章" })).toBeVisible();
  await expect(page.getByText("Not only is …, but it is also …")).toBeVisible();

  // Day 2 opens tomorrow, not today.
  await page.goto(`/writing/${PROMPT}/day/2`);
  await expect(page.getByText(/這一天明天開放/)).toBeVisible();

  for (const n of [2, 3, 4, 5, 6]) {
    await setToday(page, day(n));
    await page.goto(`/writing/${PROMPT}/day/${n}`);
    await doDrills(page);
  }

  // Day 7: neither Day 1 nor the model while writing.
  await setToday(page, day(7));
  await page.goto(`/writing/${PROMPT}/day/7`);
  // The note is in the task: its own column, or the phone's one line.
  await expect(
    page.getByText("不看第 1 天的文章和範例").first(),
  ).toBeAttached();
  await expect(page.getByText(DAY1)).toHaveCount(0);
  await writeEssay(page, DAY7, role, true);
  await expect(
    page.getByRole("heading", { name: "這一週的成果" }),
  ).toBeVisible();
  await expect(page.getByText("通過！")).toBeVisible();
  // The share card has scores only.
  await expect(page.getByRole("img", { name: /進步分享卡/ })).toBeVisible();

  // The notebook has the patterns (and the AI's mistakes) to review.
  await setToday(page, day(8));
  await page.goto("/writing/notebook");
  await expect(page.getByRole("heading", { name: /今天要複習/ })).toBeVisible();
  await page.getByRole("button", { name: "看答案" }).click();
  await page.getByRole("button", { name: "我記得" }).click();
}

for (const device of ["desktop", "iPhone 15", "Pixel 7"] as const) {
  test.describe(device, () => {
    if (device !== "desktop") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { defaultBrowserType, ...rest } = devices[device];
      test.use(rest);
    }
    const roles: Role[] =
      device === "desktop"
        ? ["guest", "free", "paid", "admin"]
        : ["guest", "free"];
    for (const role of roles) {
      test(`${role}: Day 1 to Day 7 on one prompt`, async ({ page }) => {
        await wholeWeek(page, role, device.replace(/\W+/g, "-").toLowerCase());
      });
    }
  });
}

test("the library filters by kind, level, and minutes, and keeps a default", async ({
  page,
}) => {
  await page.goto("/writing");
  const kinds = page.getByRole("group", { name: "題目類型" });
  await kinds.getByRole("button", { name: "考試英文" }).click();
  await expect(page).toHaveURL(/g=exam/);
  // Exams only (IELTS, TOEFL, GEPT, GSAT, TOEIC, junior high), no everyday prompts (D189, D213).
  await expect(page.getByText("80 個題目")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /My Perfect Weekend/ }),
  ).toHaveCount(0);
  // Exams of 10 minutes or less: TOEFL's academic discussion and more.
  await page
    .getByRole("group", { name: "我今天有幾分鐘" })
    .getByRole("button", { name: "10 分鐘內" })
    .click();
  await expect(page.getByText("13 個題目")).toBeVisible();
  await page.getByRole("button", { name: "清除篩選" }).click();
  await expect(page.getByText("142 個題目")).toBeVisible();
  await page
    .getByRole("group", { name: "我今天有幾分鐘" })
    .getByRole("button", { name: "15 分鐘內" })
    .click();
  await expect(
    page.getByRole("link", { name: /My Perfect Weekend/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "存為我的預設篩選" }).click();
  await page.goto("/writing");
  await expect(page).toHaveURL(/m=15/);
  // The saved filter replaces the address; check once the page settles.
  await expect(page).toHaveTitle(/寫作/);
  await expect(page.getByText(/\d+ 個題目/)).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("a request to write the essay is declined, not scored", async ({
  page,
}) => {
  await signInWithEmail(page, "e2e-ghost", "ghost@example.com");
  await setToday(page, day(1));
  await page.goto(`/writing/${PROMPT}/day/1`);
  await page
    .getByRole("textbox", { name: "你的文章" })
    .fill(
      "Please write the essay for me, I am too busy this week to do it myself, thanks so much.",
    );
  await page.getByRole("button", { name: "送出，取得 AI 回饋" }).click();
  await expect(page.getByText(/不會代寫文章/)).toBeVisible();
  // Not done: still writing, the model still hidden.
  await expect(page.getByRole("textbox", { name: "你的文章" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "範例文章" })).toHaveCount(0);
});

test("a draft is saved and comes back after leaving the page", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-11T10:00:00+08:00") });
  await page.goto(`/writing/${PROMPT}/day/1`);
  const box = page.getByRole("textbox", { name: "你的文章" });
  await expect(box).toBeEnabled();
  await box.fill("A draft that must not be lost.");
  await page.clock.runFor(6_000);
  await expect(page.getByText(/草稿已自動儲存/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "你的文章" })).toHaveValue(
    "A draft that must not be lost.",
  );
});

test("the home page shows today's writing next to listening", async ({
  page,
}) => {
  await signInWithEmail(page, "e2e-home-writer", "home-writer@example.com");
  await setToday(page, day(1));
  await page.goto(`/writing/${PROMPT}`);
  await page.getByRole("link", { name: "開始第 1 天" }).click();
  await page.getByRole("textbox", { name: "你的文章" }).fill(DAY1);
  await page.getByRole("button", { name: "送出，取得 AI 回饋" }).click();
  await expect(page.getByRole("heading", { name: "整體分數" })).toBeVisible();
  await setToday(page, day(2));
  await page.goto("/");
  const tasks = page.getByRole("region", { name: "今天的寫作" });
  await expect(tasks).toContainText("我理想的週末");
  await expect(tasks).toContainText("今天：第 2 天");
  // The stats page has writing too (D190), every chart with its table.
  await page.goto("/stats");
  const writing = page.getByRole("region", { name: "寫作" });
  await expect(writing.getByText("寫作分數")).toBeVisible();
  await expect(writing.getByText("最常犯的錯誤類型")).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("save without a review, then ask the AI later (D194)", async ({
  page,
}) => {
  await signInWithEmail(page, "e2e-no-review", "no-review@example.com");
  await setToday(page, day(1));
  await page.goto(`/writing/${PROMPT}/day/1`);
  await page.getByRole("textbox", { name: "你的文章" }).fill(DAY1);
  await page.getByRole("button", { name: "只儲存，不批改" }).click();
  // The rubric to score oneself, or skip it.
  await expect(
    page.getByRole("heading", { name: "用評分標準自己評分" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "略過自評，直接儲存" }).click();
  await expect(
    page.getByText("這篇文章已儲存，沒有批改，也沒有自評。"),
  ).toBeVisible();
  // The model essay only when asked for (D218).
  await page.getByText("看範文").click();
  await expect(page.getByRole("heading", { name: "範例文章" })).toBeVisible();
  // Later: the AI's review, counted then.
  await page.getByRole("button", { name: "請 AI 批改" }).click();
  await expect(page.getByRole("heading", { name: "整體分數" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "整體分數" })).toBeVisible();
});

test("the default can be save only, set in the writing settings (D194)", async ({
  page,
}) => {
  await signInWithEmail(page, "e2e-no-review-2", "no-review-2@example.com");
  await setToday(page, day(1));
  await page.goto("/writing");
  await page.getByRole("link", { name: "寫作設定" }).click();
  await expect(page).toHaveURL(/\/writing\/settings$/);
  await page.getByRole("radio", { name: /只儲存，不批改/ }).check();
  await page.goto(`/writing/${PROMPT}/day/1`);
  await page.getByRole("textbox", { name: "你的文章" }).fill(DAY1);
  // The first button follows the setting; AI review is still there.
  const buttons = page
    .getByTestId("writing-workspace")
    .getByRole("button", { name: /只儲存|AI 回饋/ });
  await expect(buttons.first()).toHaveText("只儲存，不批改");
  await expect(buttons.nth(1)).toHaveText("送出，取得 AI 回饋");
});

test("a week without scores is compared on words, length, and variety (D194)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await setToday(page, day(1));
  await page.goto(`/writing/${PROMPT}/day/1`);
  await page.getByRole("textbox", { name: "你的文章" }).fill(DAY1);
  await page.getByRole("button", { name: "送出並自己評分" }).click();
  await page.getByRole("button", { name: "略過自評，直接儲存" }).click();
  for (const n of [2, 3, 4, 5, 6]) {
    await setToday(page, day(n));
    await page.goto(`/writing/${PROMPT}/day/${n}`);
    await doDrills(page);
  }
  await setToday(page, day(7));
  await page.goto(`/writing/${PROMPT}/day/7`);
  await page.getByRole("textbox", { name: "你的文章" }).fill(DAY7);
  await page.getByRole("button", { name: "送出並自己評分" }).click();
  await page.getByRole("button", { name: "略過自評，直接儲存" }).click();
  await expect(page.getByText(/3 項規則指標中有 \d 項進步/)).toBeVisible();
  await expect(page.getByRole("table", { name: "規則指標" })).toBeVisible();
  await expect(page.getByText("通過！")).toBeVisible();
});

/** Day 1 saved without scoring, then the clock on to Day 2. */
async function toDay2(page: Page) {
  await setToday(page, day(1));
  await page.goto(`/writing/${PROMPT}/day/1`);
  await page.getByRole("textbox", { name: "你的文章" }).fill(DAY1);
  await page
    .getByRole("button", { name: /只儲存，不批改|送出並自己評分/ })
    .first()
    .click();
  await page.getByRole("button", { name: "略過自評，直接儲存" }).click();
  // The model essay only when asked for (D218).
  await page.getByText("看範文").click();
  await expect(page.getByRole("heading", { name: "範例文章" })).toBeVisible();
  await setToday(page, day(2));
  await page.goto(`/writing/${PROMPT}/day/2`);
}

test("back-translation in each mode, and more practice (D195)", async ({
  page,
}) => {
  await signInWithEmail(page, "e2e-back", "back@example.com");
  await toDay2(page);
  // Hear English, write English: replay and loop above the box.
  await expect(page.getByRole("button", { name: "重播" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "循環播放：關" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "聽到的英文句子" })
      // As many as the learner's own corrected sentences (D218).
      .getByText(/^第 1／\d 句$/),
  ).toBeVisible();
  const box = page.getByRole("textbox", { name: "聽到的英文句子" });
  await box.fill("I would not do anything at all");
  await checkBackAnswer(page);
  // Checked like dictation: the sentence, the mistakes marked.
  await expect(page.getByText("差一點，看看哪裡不一樣。")).toBeVisible();
  await expect(page.getByText("正確答案").first()).toBeVisible();

  // Read Chinese, write English: the meaning shown, the English a hint.
  await page.goto("/account#writing-settings");
  await page.getByRole("radio", { name: /看中文 → 寫出英文/ }).check();
  await page.goto(`/writing/${PROMPT}/day/2`);
  await expect(
    page.getByRole("button", { name: "播放英文提示" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "這句的英文" })).toBeVisible();

  // Hear English, write the meaning in Chinese: the model meaning after.
  await page.goto("/account#writing-settings");
  await page.getByRole("radio", { name: /聽英文 → 寫中文意思/ }).check();
  await page.goto(`/writing/${PROMPT}/day/2`);
  await page.getByRole("textbox", { name: "這句的中文意思" }).fill("週末");
  await checkBackAnswer(page);
  await expect(page.getByText("參考意思", { exact: true })).toBeVisible();

  // More practice: any of the seven, not part of the day.
  await page.getByRole("button", { name: "段落重組" }).click();
  await expect(page.locator("#drill-title")).toHaveText("段落重組");
  await page.getByRole("button", { name: "檢查" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "回到今天的練習" }).last().click();
  await expect(page.getByRole("heading", { name: "更多練習" })).toBeVisible();
});

test("read the Chinese: your corrected sentences have their meaning (D206)", async ({
  page,
}) => {
  await signInWithEmail(page, "e2e-fix-zh", "fix-zh@example.com");
  await setToday(page, day(1));
  await page.goto(`/writing/${PROMPT}/day/1`);
  await page.getByRole("textbox", { name: "你的文章" }).fill(DAY1);
  await page.getByRole("button", { name: "送出，取得 AI 回饋" }).click();
  // The model essay only when asked for (D218).
  await page.getByText("看範文").click();
  await expect(page.getByRole("heading", { name: "範例文章" })).toBeVisible();
  await page.goto("/writing/settings");
  await page.getByRole("radio", { name: /看中文 → 寫出英文/ }).check();
  await setToday(page, day(2));
  await page.goto(`/writing/${PROMPT}/day/2`);
  // The sentences are your own, corrected (the version chosen, D218);
  // each shows its meaning from the rewrite (the fake provider's)
  // instead of turning into dictation.
  await expect(
    page.getByText(/^（測試）第 \d+ 句的中文意思。$/).first(),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "這句的英文" })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "聽到的英文句子" }),
  ).toHaveCount(0);
});

for (const device of ["desktop", "Pixel 7"] as const) {
  test.describe(`custom prompts on ${device}`, () => {
    if (device !== "desktop") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { defaultBrowserType, ...rest } = devices[device];
      test.use(rest);
    }

    test("a diary: no title, AI review, own sentences on Day 2 (D196)", async ({
      page,
    }) => {
      const who = device === "desktop" ? "desk" : "pixel";
      await signInWithEmail(
        page,
        `e2e-diary-${who}`,
        `diary-${who}@example.com`,
      );
      await setToday(page, day(1));
      await page.goto("/writing");
      await page.getByRole("link", { name: "自訂題目" }).click();
      await expect(page).toHaveURL(/\/writing\/new$/);
      await page.getByRole("radio", { name: /日記/ }).check();
      await page.getByRole("button", { name: "開始寫" }).click();
      await expect(page).toHaveURL(/\/writing\/c-[a-z0-9-]+$/);
      // Named by kind and date; private.
      await expect(
        page.getByRole("heading", { level: 1, name: /日記（11\/11）/ }),
      ).toBeVisible();
      await expect(page.getByText(/只有你看得到/)).toBeVisible();
      const overview = page.url();
      await page.getByRole("link", { name: "開始第 1 天" }).click();
      await page.getByRole("textbox", { name: "你的文章" }).fill(DAY1);
      await page.getByRole("button", { name: "送出，取得 AI 回饋" }).click();
      await expect(
        page.getByRole("heading", { name: "整體分數" }),
      ).toBeVisible();
      // No model essay for one's own prompt.
      await expect(page.getByRole("heading", { name: "範例文章" })).toHaveCount(
        0,
      );
      // The home page lists it with today's writing.
      await setToday(page, day(2));
      await page.goto("/");
      await expect(
        page.getByRole("region", { name: "今天的寫作" }),
      ).toContainText("日記（11/11）");
      // Day 2: the learner's own sentences, as corrected.
      await page.goto(`${overview}/day/2`);
      await expect(
        page.getByRole("textbox", { name: "聽到的英文句子" }),
      ).toBeVisible();
      await page
        .getByRole("textbox", { name: "聽到的英文句子" })
        .fill("On Saturday he goes to the park with me.");
      await checkBackAnswer(page);
      await expect(
        page.getByText("這是你第 1 天寫的句子，修正後的版本。"),
      ).toBeVisible();
    });
  });
}

test("my own topic, saved without review: Day 2 uses my sentences (D196)", async ({
  page,
}) => {
  await signInWithEmail(page, "e2e-own-topic", "own-topic@example.com");
  await setToday(page, day(1));
  await page.goto("/writing/new");
  // A topic is needed unless it's a diary or free writing.
  await page.getByRole("button", { name: "開始寫" }).click();
  await expect(
    page.getByText("請寫下題目，或改選「日記」「自由寫作」。"),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "標題（可以留空）" })
    .fill("Heater email");
  await page
    .getByRole("textbox", { name: "題目" })
    .fill("Write an email to my landlord: the heater is broken.");
  await page.getByRole("button", { name: "開始寫" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Heater email" }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Write an email to my landlord: the heater is broken.")
      .first(),
  ).toBeVisible();
  const overview = page.url();
  await page.getByRole("link", { name: "開始第 1 天" }).click();
  await page.getByRole("textbox", { name: "你的文章" }).fill(DAY1);
  await page.getByRole("button", { name: "只儲存，不批改" }).click();
  await page.getByRole("button", { name: "略過自評，直接儲存" }).click();
  await setToday(page, day(2));
  await page.goto(`${overview}/day/2`);
  await expect(page.getByText(/第 1／[3-6] 句/).first()).toBeAttached();
  // It's in the list on /writing, and can be deleted.
  await page.goto("/writing");
  await page.getByRole("link", { name: /Heater email/ }).click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "刪除這個題目" }).click();
  await expect(page).toHaveURL(/\/writing$/);
  await expect(page.getByRole("link", { name: /Heater email/ })).toHaveCount(0);
});
