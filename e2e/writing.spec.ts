import AxeBuilder from "@axe-core/playwright";
import { devices, type Page } from "@playwright/test";
import {
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

/** Does whatever drill is showing until the day is done. */
async function doDrills(page: Page) {
  const done = page.getByText("今天的練習完成了！明天再來。");
  for (let step = 0; step < 12 && !(await done.isVisible()); step++) {
    const title = page.locator("#drill-title");
    await expect(title.or(done)).toBeVisible();
    if (await done.isVisible()) break;
    const kind = (await title.textContent()) ?? "";
    if (kind === "段落重組") {
      await page.getByRole("button", { name: "檢查" }).click();
    } else if (kind === "默寫重建") {
      await page.getByRole("button", { name: "開始讀" }).click();
      await page.getByRole("button", { name: "我準備好了" }).click();
      await page
        .getByRole("textbox", { name: "憑記憶寫出這段" })
        .fill("We would talk about everything.");
      await page.getByRole("button", { name: "檢查" }).click();
    } else if (kind === "聽寫轉寫作") {
      await expect(
        page.getByRole("link", { name: "開啟聆聽模式（新分頁）" }),
      ).toHaveAttribute("href", /\/videos\/sintel\/listen/);
      await page
        .getByRole("textbox", { name: "你的摘要或回應" })
        .fill(
          "The video is about a girl who looks for her lost dragon. She travels far and meets many people, and in the end she finds out something sad about it.",
        );
      await page.getByRole("button", { name: "檢查" }).click();
    } else {
      // Fix, pattern, combine, paraphrase: write, check at once.
      const box = page.locator("textarea").first();
      await box.fill(
        "Not only is my bike fast, but it is also light after that because.",
      );
      await page.getByRole("button", { name: "檢查" }).click();
      await expect(page.getByText(/參考答案：/)).toBeVisible();
    }
    await page.getByRole("button", { name: "下一步" }).click();
  }
  await expect(done).toBeVisible();
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
  await expect(page.getByText("不看第 1 天的文章和範例")).toBeVisible();
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
  await kinds.getByRole("button", { name: "考試" }).click();
  await expect(page).toHaveURL(/g=exam/);
  // Exams only: IELTS and the GSAT, no everyday prompts (D189).
  await expect(page.getByText("15 個題目")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /My Perfect Weekend/ }),
  ).toHaveCount(0);
  // Exams of 10 minutes or less: TOEFL's academic discussion.
  await page
    .getByRole("group", { name: "我今天有幾分鐘" })
    .getByRole("button", { name: "10 分鐘內" })
    .click();
  await expect(page.getByText("3 個題目")).toBeVisible();
  await page.getByRole("button", { name: "清除篩選" }).click();
  await expect(page.getByText("42 個題目")).toBeVisible();
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
});
