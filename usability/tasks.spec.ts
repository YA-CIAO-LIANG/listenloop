import AxeBuilder from "@axe-core/playwright";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import mock from "../e2e/mock-supabase/practices.json";
import sintel from "../data/videos/sintel.json";
import {
  misheardWords,
  pickQuizWords,
  quizCandidates,
} from "../lib/vocab-quiz";
import {
  expect,
  setToday,
  signInAsAdmin,
  signInAsAuthor,
  signInAsBuyer,
  signInAsLearner,
  signInAsPaid,
  signInAsStudent,
  signInWithEmail,
  test,
} from "../e2e/fixtures";

/**
 * The AI usability test's tasks (docs/usability-ai-test.md, D170): whole
 * flows, as a guest, a free account, a paid account, and an admin, on
 * two phones and a laptop. Each step takes a screenshot and measures the
 * page, so Claude can review it as the personas in docs/personas.md. A
 * step that can't be done is recorded as a failure of the task, not of
 * the run. The flows follow the E2E tests named in each task.
 */
const ROUND = process.env.USABILITY_ROUND ?? "1";
const PORT = process.env.E2E_PORT ?? "3200";

// Generous: a slow step is a finding, not a crash of the run.
test.setTimeout(240_000);
const OUT = join(process.cwd(), "usability-results", `round-${ROUND}`);

type Measure = {
  overflow: boolean;
  wide: string[];
  smallTargets: string[];
  aboveFoldChars: number;
  aboveFoldText: string;
  h1: string;
  longestParagraph: number;
  avgSentenceChars: number;
  headings: number;
  axe: string[];
};

async function measure(page: Page, phone: boolean): Promise<Measure> {
  const found = await page.evaluate(
    (min) => {
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden";
      };
      const targets = [
        ...document.querySelectorAll(
          "a[href], button, input:not([type=hidden]), select, textarea, [role=button]",
        ),
      ]
        .filter(visible)
        // The skip link is visually hidden until focused.
        .filter((el) => el.getBoundingClientRect().width > 2)
        // Links inside running text are exempt (WCAG 2.5.8).
        .filter((el) => !(el.tagName === "A" && el.closest("p, li")))
        .flatMap((el) => {
          // A visually hidden radio or checkbox is reached by its label.
          const box = (el.closest("label") ?? el).getBoundingClientRect();
          return box.width < min || box.height < min
            ? [
                `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(box.width)}×${Math.round(box.height)}`,
              ]
            : [];
        });
      const main = document.querySelector("main");
      const text = (main?.innerText ?? "").trim();
      const paragraphs = [...document.querySelectorAll("main p")].map(
        (p) => (p as HTMLElement).innerText.length,
      );
      const sentences = text
        .split(/[。！？!?\n]|\.\s/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1);
      // What a visitor sees without scrolling (the five-second test).
      const fold: string[] = [];
      const walker = document.createTreeWalker(
        main ?? document.body,
        NodeFilter.SHOW_TEXT,
      );
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;
        if (!parent || !visible(parent)) continue;
        const top = parent.getBoundingClientRect().top;
        if (top < window.innerHeight && top > -window.innerHeight) {
          const piece = (node.textContent ?? "").trim();
          if (piece) fold.push(piece);
        }
      }
      const above = fold.join(" ");
      // Wider than the device (a phone's page can grow past its screen).
      const limit = Math.min(window.innerWidth, window.screen.width);
      const wide = [...document.querySelectorAll("body *")]
        .filter((el) => el.getBoundingClientRect().right > limit + 1)
        .filter(
          (el) =>
            !el.parentElement ||
            el.parentElement.getBoundingClientRect().right <= limit + 1,
        )
        .slice(0, 5)
        .map(
          (el) =>
            `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} → ${Math.round(el.getBoundingClientRect().right)}`,
        );
      return {
        overflow: document.documentElement.scrollWidth > limit,
        wide,
        smallTargets: targets.slice(0, 10),
        aboveFoldChars: above.replace(/\s/g, "").length,
        aboveFoldText: above.slice(0, 400),
        h1: (document.querySelector("h1")?.textContent ?? "").trim(),
        longestParagraph: Math.max(0, ...paragraphs),
        avgSentenceChars: sentences.length
          ? Math.round(
              sentences.reduce((sum, s) => sum + s.length, 0) /
                sentences.length,
            )
          : 0,
        headings: document.querySelectorAll("main h1, main h2, main h3").length,
      };
    },
    phone ? 44 : 24,
  );
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .exclude("iframe")
    .analyze()
    .then((r) => r.violations.map((v) => v.id))
    .catch(() => []);
  return { ...found, axe };
}

/** One step of a task: do it, then screenshot and measure. */
async function step(
  page: Page,
  task: string,
  name: string,
  action: () => Promise<unknown>,
) {
  const project = test.info().project.name;
  const dir = join(OUT, project);
  mkdirSync(dir, { recursive: true });
  const started = Date.now();
  let error: string | null = null;
  try {
    await action();
    await page.waitForLoadState("networkidle", { timeout: 5_000 });
  } catch (e) {
    const message = (e as Error).message.split("\n")[0];
    if (!/networkidle|waitForLoadState/.test(message)) error = message;
  }
  const file = `${task}--${name}.png`;
  await page
    .screenshot({ path: join(dir, file), fullPage: true })
    .catch(() => {});
  const metrics = await measure(page, project !== "desktop").catch(
    () => ({}) as Partial<Measure>,
  );
  appendFileSync(
    join(OUT, "metrics.jsonl"),
    JSON.stringify({
      project,
      task,
      step: name,
      url: page.url() ? new URL(page.url()).pathname : "",
      ms: Date.now() - started,
      error,
      file: `${project}/${file}`,
      ...metrics,
    }) + "\n",
  );
  return error === null;
}

const official = mock.official;
const ready = mock.ready;
const readyId = `p-${ready.id}`;
const sharedId = `p-${mock.shared.id}`;
const readySentences = ready.practice_sentences.map((s) => s.en);

/** Answers every sentence of a dictation day, as the E2E tests do. */
async function answerAll(page: Page, answers: string[]) {
  const input = page.getByRole("textbox", { name: "你聽到的句子" });
  for (const [i, answer] of answers.entries()) {
    await input.fill(answer);
    await page.getByRole("button", { name: "送出" }).click();
    await page
      .getByRole("button", {
        name: i === answers.length - 1 ? "查看結果" : "下一句",
      })
      .click();
  }
}

/** Clicks or taps, as the device would. */
async function press(page: Page, locator: ReturnType<Page["locator"]>) {
  if (test.info().project.name === "desktop") await locator.click();
  else await locator.tap();
}

/** Closes the first-visit notices (terms, guide) if they're there. */
async function dismissNotices(page: Page) {
  const ok = page.getByRole("button", { name: /^(知道了|略過)$/ });
  for (let n = 0; n < 3 && (await ok.count()) > 0; n++) {
    await ok.first().click();
  }
}

/** A speech recognizer that hears the sentence on the page (or none). */
async function microphone(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    if (localStorage.getItem("usability-no-mic") === "1") {
      delete w.SpeechRecognition;
      delete w.webkitSpeechRecognition;
      return;
    }
    class FakeRecognition {
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => {
          const said =
            document.querySelector("p[lang=en].text-sentence")?.textContent ??
            "";
          const result = Object.assign([{ transcript: said }], {
            isFinal: true,
          });
          this.onresult?.({ results: [result] });
          this.onend?.();
        }, 300);
      }
      stop() {
        this.onend?.();
      }
      abort() {}
    }
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
  });
}

const dayDate = (n: number) => `2026-11-0${n}`;
const shadowDone = (n: number) => ({
  done: true,
  date: dayDate(n),
  sentences: readySentences.map(() => ({ done: true, coverage: 1 })),
});
/** mock.ready's progress with days 1 … last done, a day apart. */
function readyProgress(last: number) {
  const days: Record<string, unknown> = {
    1: {
      done: true,
      date: dayDate(1),
      score: 0.5,
      // "station" misheard: one word for the review list.
      answers: ["The nation is on the left.", "Turn right at the bank."],
    },
  };
  for (let n = 2; n <= last; n++) days[n] = shadowDone(n);
  return {
    videoId: readyId,
    week: 1,
    startedAt: dayDate(1),
    days,
    status: "in-progress",
    history: [],
  };
}
const seed = (page: Page, key: string, value: unknown) =>
  page.addInitScript(
    ([k, v]) => {
      if (!localStorage.getItem(k)) localStorage.setItem(k, v);
    },
    [key, JSON.stringify(value)] as const,
  );

// ---------------------------------------------------------------- guest

test("T1 guest first visit: five seconds, level test, first material (P1 國中生, P5 長輩, P8 高三生)", async ({
  page,
}) => {
  await setToday(page, "2026-11-02");
  await step(page, "t1-first", "1-home", () => page.goto("/"));
  await step(page, "t1-first", "2-notices-closed", () => dismissNotices(page));
  await step(page, "t1-first", "3-level-test-intro", async () => {
    await page
      .getByRole("link", { name: "不確定從哪裡開始？做 2 分鐘程度測驗" })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: "程度測驗" }),
    ).toBeVisible();
  });
  await step(page, "t1-first", "4-level-test-question", async () => {
    await page.getByRole("button", { name: "開始測驗" }).click();
    await expect(page.getByLabel("你聽到的句子")).toBeVisible();
  });
  await step(page, "t1-first", "5-level-result", async () => {
    const field = page.getByLabel("你聽到的句子");
    // A learner who gets most of it.
    await field.fill("can I see your passport");
    await field.press("Enter");
    await expect(page.getByText("建議的程度")).toBeVisible();
  });
  await step(page, "t1-first", "6-first-material", async () => {
    await page.getByRole("link", { name: "從推薦的第一份開始" }).click();
    await expect(page).toHaveURL(new RegExp(`/videos/p-${official.id}`));
  });
  await step(page, "t1-first", "7-library-at-level", () => page.goto("/"));
});

test("T2 guest in English and at 200% text (P7 英文介面, P5 長輩)", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "ll-locale", value: "en", url: `http://localhost:${PORT}` },
  ]);
  await step(page, "t2-en", "1-home-en", () => page.goto("/"));
  await step(page, "t2-en", "2-official-en", () =>
    page.goto(`/videos/p-${official.id}`),
  );
  await context.addCookies([
    { name: "ll-locale", value: "zh-Hant", url: `http://localhost:${PORT}` },
  ]);
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    });
  });
  await step(page, "t2-en", "3-home-200", () => page.goto("/"));
});

// ---------------------------------------------------------------- free

test("T3 free: Day 1 dictation, vocab quiz, handout, listening mode (P2 高中生, P8 高三生, P9 研究生)", async ({
  page,
}) => {
  await signInAsLearner(page);
  await setToday(page, "2026-11-01");
  const answers = sintel.sentences.map((s) =>
    s.i === 2 ? s.en.replace("unprepared", "prepared") : s.en,
  );
  const input = page.getByRole("textbox", { name: "你聽到的句子" });
  await step(page, "t3-day1", "1-open", () =>
    page.goto("/videos/sintel/day/1"),
  );
  await step(page, "t3-day1", "2-first-answer", async () => {
    await dismissNotices(page);
    // The first sentence with the last word missed.
    await input.fill(answers[0].split(" ").slice(0, -1).join(" "));
    await page.getByRole("button", { name: "送出" }).click();
    await expect(page.getByText(/這句正確率/)).toBeVisible();
  });
  await step(page, "t3-day1", "3-result", async () => {
    await page.getByRole("button", { name: "下一句" }).click();
    await answerAll(page, answers.slice(1));
    await expect(page.getByText("單字測驗（約 3 分鐘）")).toBeVisible();
  });
  const words = pickQuizWords(
    quizCandidates(sintel),
    misheardWords(sintel.sentences, answers),
  );
  await step(page, "t3-day1", "4-quiz-spell", async () => {
    await page.getByRole("link", { name: /開始測驗/ }).click();
    await page.getByLabel("你聽到的單字").fill(words[0].word);
    await page.getByRole("button", { name: "送出" }).click();
    await expect(page.getByText("拼對了！")).toBeVisible();
  });
  await step(page, "t3-day1", "5-quiz-meaning", async () => {
    await page.getByRole("button", { name: /下一關/ }).click();
    const choices = page.getByRole("group", { name: /這個字的中文意思/ });
    await choices.getByLabel(words[0].zh, { exact: true }).check();
    await page.getByRole("button", { name: "送出" }).click();
  });
  await step(page, "t3-day1", "6-quiz-result", async () => {
    for (const [i, word] of words.entries()) {
      if (i === 0) {
        await page
          .getByRole("button", {
            name: words.length === 1 ? "看結果" : "下一個單字",
          })
          .click();
        continue;
      }
      await page.getByLabel("你聽到的單字").fill(word.word);
      await page.getByRole("button", { name: "送出" }).click();
      await page.getByRole("button", { name: /下一關/ }).click();
      await page
        .getByRole("group", { name: /這個字的中文意思/ })
        .getByLabel(word.zh, { exact: true })
        .check();
      await page.getByRole("button", { name: "送出" }).click();
      await page
        .getByRole("button", {
          name: i === words.length - 1 ? "看結果" : "下一個單字",
        })
        .click();
    }
    await expect(page.getByRole("heading", { name: "測驗結果" })).toBeVisible();
  });
  await step(page, "t3-day1", "7-handout", () =>
    page.goto("/videos/sintel/handout"),
  );
  await step(page, "t3-day1", "8-listen-mode", async () => {
    await page.goto("/videos/sintel/listen");
    await page.getByText("盲聽", { exact: true }).click();
  });
});

test("T4 free: Days 2–6 shadowing, hands-free and 'I said it' (P2 高中生, P1 國中生, P6 無障礙)", async ({
  page,
}) => {
  await signInAsAuthor(page);
  await microphone(page);
  await seed(page, `ll-progress:v1:${readyId}`, readyProgress(1));

  // Day 2: hands-free with a microphone that hears the sentence.
  await setToday(page, dayDate(2));
  await step(page, "t4-shadow", "1-day2-open", () =>
    page.goto(`/videos/${readyId}/day/2`),
  );
  await step(page, "t4-shadow", "2-day2-hands-free", async () => {
    await dismissNotices(page);
    await press(page, page.getByRole("button", { name: "開始練習" }));
    await expect(page.getByText("今天的跟讀完成了！")).toBeVisible({
      timeout: 30_000,
    });
  });

  // Days 3–6 without a microphone: "I said it".
  await page.evaluate(() => {
    localStorage.setItem("usability-no-mic", "1");
    localStorage.setItem("ll-hands-free:v1", "off");
  });
  for (let n = 3; n <= 6; n++) {
    await setToday(page, dayDate(n));
    const ok = await step(
      page,
      "t4-shadow",
      `${n}-day${n}-said-it`,
      async () => {
        await page.goto(`/videos/${readyId}/day/${n}`);
        // A day already finished on an earlier attempt is a retry.
        await expect(
          page.getByRole("heading", { name: new RegExp(`第 ${n} 天：跟讀`) }),
        ).toBeVisible();
        for (const [i] of readySentences.entries()) {
          await expect(
            page.getByText(`第 ${i + 1} / ${readySentences.length} 句`),
          ).toBeVisible();
          if (n === 3 && i === 0) {
            // The view before tapping, once.
            await page.screenshot({
              path: join(
                OUT,
                test.info().project.name,
                "t4-shadow--3a-no-mic.png",
              ),
              fullPage: true,
            });
          }
          await press(page, page.getByRole("button", { name: "我念完了" }));
        }
        await expect(page.getByText("今天的跟讀完成了！")).toBeVisible();
      },
    );
    if (!ok) break;
  }
  await step(page, "t4-shadow", "7-home-after-day6", () => page.goto("/"));
});

test("T5 free: Day 7, share card, survey (P2 高中生, P8 高三生)", async ({
  page,
}) => {
  await signInAsAuthor(page);
  await seed(page, `ll-progress:v1:${readyId}`, readyProgress(6));
  await setToday(page, dayDate(7));
  await step(page, "t5-day7", "1-open", () =>
    page.goto(`/videos/${readyId}/day/7`),
  );
  await step(page, "t5-day7", "2-result", async () => {
    await dismissNotices(page);
    await answerAll(page, readySentences);
    await expect(page.getByText("第 1 週結果")).toBeVisible();
  });
  await step(page, "t5-day7", "3-share-card", async () => {
    const card = page.getByRole("heading", { name: "進步分享卡" });
    await card.scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("img", { name: /進步分享卡：第 1 天/ }),
    ).toBeVisible();
  });
  // The Day 7 satisfaction survey (D164).
  const survey = page.getByRole("region", {
    name: "花 10 秒告訴我們這週的感覺",
  });
  await step(page, "t5-day7", "4-survey", async () => {
    await survey.scrollIntoViewIfNeeded();
    await press(page, survey.getByText("9", { exact: true }));
    await survey
      .getByLabel("最想改進或最喜歡的一件事（選填）")
      .fill("第 7 天看到進步很有成就感");
  });
  await step(page, "t5-day7", "5-survey-sent", async () => {
    await survey.getByRole("button", { name: "送出" }).click();
    await expect(
      page.getByText("謝謝你的回饋！我們每一則都會看。"),
    ).toBeVisible();
  });
});

test("T6 free: misheard words, my quota, my folders (P3 留學生, P9 研究生, P4 上班族)", async ({
  page,
}) => {
  await signInAsAuthor(page);
  await seed(page, `ll-progress:v1:${readyId}`, readyProgress(1));
  await setToday(page, dayDate(2));
  await step(page, "t6-mine", "1-home-today", () => page.goto("/"));
  await step(page, "t6-mine", "2-review", async () => {
    await page.goto("/review");
    await page.getByLabel("空格裡是哪個字？").fill("station");
    await page.getByLabel("空格裡是哪個字？").press("Enter");
    await expect(page.getByText("答對了")).toBeVisible();
  });
  await step(page, "t6-mine", "3-account", () => page.goto("/account"));
  await step(page, "t6-mine", "4-my-quota", async () => {
    await page.getByRole("link", { name: "查看我的額度 →" }).click();
    await expect(
      page.getByRole("heading", { name: "我的額度", level: 1 }),
    ).toBeVisible();
  });
  await step(page, "t6-mine", "5-materials", () => page.goto("/materials"));
  await step(page, "t6-mine", "6-new-folder", async () => {
    await page.getByRole("button", { name: "新增資料夾" }).click();
    await page
      .getByLabel("資料夾名稱")
      .fill(`英文課 ${test.info().project.name}`);
    await page.getByRole("button", { name: "建立", exact: true }).click();
    await page
      .getByRole("article")
      .filter({ hasText: ready.title })
      .getByLabel("移動到")
      .selectOption({ label: `英文課 ${test.info().project.name}` });
    await expect(
      page.getByRole("link", {
        name: new RegExp(`英文課 ${test.info().project.name}`),
      }),
    ).toContainText("1 份");
  });
  // Clean up for the next device: deleting the folder puts it back.
  await page
    .getByRole("link", {
      name: new RegExp(`英文課 ${test.info().project.name}`),
    })
    .click();
  await page.getByRole("button", { name: "刪除資料夾" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "刪除資料夾" })
    .click();
  await expect(page).toHaveURL(/\/materials$/);
});

test("T7 free: create a material in this week's 2 minutes, revise it (P3 留學生, P8 高三生, P10 老師)", async ({
  page,
}) => {
  await signInAsLearner(page);
  await step(page, "t7-create", "1-open", () => page.goto("/materials/new"));
  await step(page, "t7-create", "2-paste", async () => {
    await dismissNotices(page);
    await page
      .getByLabel("文字內容")
      .fill(
        "I missed the bus this morning. So I walked to school in the rain. My teacher smiled and gave me a towel.",
      );
  });
  await step(page, "t7-create", "3-split-translate", async () => {
    await page.getByRole("button", { name: "斷句並翻譯" }).click();
    await expect(page.getByLabel("第 1 句英文")).toBeVisible({
      timeout: 20_000,
    });
  });
  await step(page, "t7-create", "4-revise-preview", async () => {
    await page.getByLabel("修改指令").fill("改成恐怖風");
    await page.getByRole("button", { name: "修改", exact: true }).click();
    await expect(page.getByText("預覽修改")).toBeVisible();
  });
  await step(page, "t7-create", "5-revise-applied", async () => {
    await page.getByRole("button", { name: "套用" }).click();
    await expect(page.getByText(/已套用/)).toBeVisible();
    await expect(page.getByRole("button", { name: "建立練習" })).toBeEnabled();
  });
});

// ---------------------------------------------------------------- paid

test("T8 paid: create from an uploaded recording (P3 留學生, P9 研究生)", async ({
  page,
}) => {
  await signInAsPaid(page);
  await step(page, "t8-upload", "1-open", async () => {
    await page.goto("/materials/new");
    await dismissNotices(page);
    await page.getByText("上傳音檔").click();
  });
  await step(page, "t8-upload", "2-transcribed", async () => {
    await page
      .getByLabel("選擇 MP3 或 MP4 檔案")
      .setInputFiles("tests/fixtures/ai/azure-speech/us-female.mp3");
    await page.getByRole("button", { name: /讀取並轉成文字/ }).click();
    await expect(page.getByLabel("第 1 句英文")).not.toHaveValue("", {
      timeout: 30_000,
    });
  });
  await step(page, "t8-upload", "3-translated", async () => {
    await page.getByRole("button", { name: "翻譯" }).click();
    await expect(page.getByLabel("第 1 句中文")).not.toHaveValue("");
    await expect(page.getByRole("button", { name: "建立練習" })).toBeEnabled();
  });
});

// --------------------------------------------- public, pricing, upgrade

test("T9 free: public material preview, upgrade, pricing, fake door (P10 老師, P4 上班族, P1 國中生)", async ({
  page,
}) => {
  // A free account of its own per device: the waiting list remembers.
  await signInAsBuyer(page, `usability-free-${test.info().project.name}`);
  await step(page, "t9-upgrade", "1-explore", () => page.goto("/explore"));
  await step(page, "t9-upgrade", "2-preview", async () => {
    await page.goto(`/videos/${sharedId}`);
    await expect(page.getByText("公開教材預覽")).toBeVisible();
  });
  await step(page, "t9-upgrade", "3-pricing", async () => {
    await page.getByRole("link", { name: "升級即可練習這份教材" }).click();
    await expect(page).toHaveURL(/\/pricing/);
  });
  await step(page, "t9-upgrade", "4-fake-door", async () => {
    const plus = page.getByRole("listitem").filter({ hasText: "訂閱 Plus" });
    await press(page, plus.getByRole("button", { name: "訂閱 Plus" }));
    await expect(page.getByRole("dialog")).toBeVisible();
  });
  await step(page, "t9-upgrade", "5-joined", async () => {
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "加入名單" })
      .click();
    await expect(
      page.getByRole("dialog").getByText("已加入名單"),
    ).toBeVisible();
  });
});

// ------------------------------------------- appearance and accounts

test("T10 paid: theme, background, sign out, switch account (P5 長輩, P7 英文介面)", async ({
  page,
}) => {
  await signInAsPaid(page);
  await step(page, "t10-switch", "1-account", () => page.goto("/account"));
  await step(page, "t10-switch", "2-background", async () => {
    await page
      .getByRole("region", { name: "背景主題" })
      .getByRole("radio", { name: /暖灰/ })
      .check();
    await expect(page.locator("html")).toHaveAttribute("data-bg", "warm-gray");
  });
  await step(page, "t10-switch", "3-dark", async () => {
    await page
      .getByRole("group", { name: "外觀" })
      .filter({ visible: true })
      .first()
      .getByText("深色", { exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
  await step(page, "t10-switch", "4-signed-out", async () => {
    await page.goto("/");
    await page.getByRole("button", { name: "帳號" }).click();
    await page.getByRole("button", { name: "登出" }).click();
    await expect(
      page.getByRole("link", { name: "登入" }).first(),
    ).toBeVisible();
  });
  await step(page, "t10-switch", "5-other-account", async () => {
    await signInAsLearner(page);
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveAttribute("data-bg", /.+/);
  });
});

// ---------------------------------------------------------- time zones

for (const zone of ["Asia/Taipei", "America/Los_Angeles"] as const) {
  test.describe(zone, () => {
    test.use({ timezoneId: zone });
    test(`T11 dates in ${zone} (P9 在美國的研究生)`, async ({ page }) => {
      const tag = zone === "Asia/Taipei" ? "tw" : "us";
      // 02:00 UTC on Nov 12: Nov 12 in Taiwan, still Nov 11 in California.
      await page.clock.setFixedTime(new Date("2026-11-12T02:00:00Z"));
      await signInAsAuthor(page);
      await seed(page, "ll-progress:v1:sintel", {
        videoId: "sintel",
        week: 1,
        startedAt: "2026-11-11",
        days: {
          "1": { done: true, date: "2026-11-11", score: 0.8, answers: [] },
        },
        status: "in-progress",
        history: [],
      });
      await step(page, `t11-${tag}`, "1-home", () => page.goto("/"));
      await step(page, `t11-${tag}`, "2-day2", () =>
        page.goto("/videos/sintel/day/2"),
      );
      await step(page, `t11-${tag}`, "3-progress", () =>
        page.goto("/practices"),
      );
    });
  });
}

// --------------------------------------------------------------- admin

test("T12 admin: dashboard, usage, creating without limits (管理員 Joe)", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await step(page, "t12-admin", "1-admin", () => page.goto("/admin"));
  await step(page, "t12-admin", "2-usage", () => page.goto("/admin/usage"));
  await step(page, "t12-admin", "3-reports", () => page.goto("/admin/reports"));
  await step(page, "t12-admin", "4-create", async () => {
    await page.goto("/materials/new");
    await expect(page.getByTestId("week-allowance")).toHaveCount(0);
  });
});

// ------------------------------------------- 2026-11-14 additions (D179)

/** A fresh account per device, so a step that changes it can't collide. */
const runId = () =>
  `${test.info().project.name}-${Math.random().toString(36).slice(2, 7)}`;

test("T13 student plan: verified by a school account, price, waiting list (P8 高三生, P3 留學生)", async ({
  page,
}) => {
  await step(page, "t13-student", "1-pricing-guest", () =>
    page.goto("/pricing"),
  );
  await signInAsStudent(page);
  await step(page, "t13-student", "2-pricing-verified", async () => {
    await page.goto("/pricing");
    await expect(page.getByTestId("student-status")).toContainText(
      "已認證學生身分",
    );
  });
  await step(page, "t13-student", "3-offer", async () => {
    await page
      .getByRole("listitem")
      .filter({ hasText: "訂閱 學生方案" })
      .getByRole("button", { name: "訂閱 學生方案" })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
  await step(page, "t13-student", "4-classes", () =>
    page.goto("/pricing/classroom"),
  );
});

test("T14 class: a teacher makes a class, a student joins, an assignment, progress (P10 老師, P1 國中生, P2 高中生)", async ({
  page,
  browser,
}) => {
  const id = runId();
  const teacher = `e2e-class-teacher-${id}`;
  const student = `e2e-class-student-${id}`;
  await signInWithEmail(page, teacher, `${teacher}@example.com`);
  await step(page, "t14-class", "1-teacher-classes", () =>
    page.goto("/classroom"),
  );
  await step(page, "t14-class", "2-create-class", async () => {
    await page.getByLabel("建立新班級").fill("三年二班 英聽");
    await page.getByRole("button", { name: "建立", exact: true }).click();
    await expect(page.getByText("三年二班 英聽").first()).toBeVisible();
  });
  await step(page, "t14-class", "3-class-page", async () => {
    await page
      .getByRole("link", { name: /三年二班 英聽/ })
      .first()
      .click();
    await expect(page.getByText("請學生輸入邀請碼")).toBeVisible();
  });
  const code =
    (await page
      .locator("main")
      .innerText()
      .then((text) => /\b([A-HJ-NP-Z2-9]{8})\b/.exec(text)?.[1])) ?? "";
  const classUrl = page.url();
  await step(page, "t14-class", "4-assign", async () => {
    await page.getByLabel("教材").selectOption({ index: 0 });
    await page.getByRole("button", { name: "指派", exact: true }).click();
    await expect(page.getByText("還沒有作業。")).toHaveCount(0);
  });

  // The student joins with the code, on their own device.
  const other = await browser.newContext({
    ...test.info().project.use,
    locale: "zh-TW",
  });
  await other.addCookies([
    {
      name: "ll-locale",
      value: "zh-Hant",
      url: `http://localhost:${PORT}`,
    },
  ]);
  const kid = await other.newPage();
  await signInWithEmail(kid, student, `${student}@example.com`);
  await step(kid, "t14-class", "5-student-join", async () => {
    await kid.goto("/classroom");
    await kid.getByLabel("邀請碼（8 碼）").fill(code);
    await kid.getByLabel("在班上的稱呼").fill("01 王小明");
    await kid.getByText("我未滿 18 歲，已經取得家長或法定代理人同意").click();
    await kid.getByRole("button", { name: "加入", exact: true }).click();
    await expect(kid.getByText("三年二班 英聽").first()).toBeVisible();
  });
  // Joining opens the class page.
  await step(kid, "t14-class", "6-student-class", async () => {
    await expect(kid.getByRole("heading", { name: "作業" })).toBeVisible();
    await expect(kid.getByText("還沒有作業。")).toHaveCount(0);
  });
  await step(kid, "t14-class", "7-student-assignment", async () => {
    await kid
      .locator("main")
      .getByRole("link", { name: /Sintel/ })
      .first()
      .click();
    await expect(kid).toHaveURL(/\/videos\//);
  });
  await other.close();

  await step(page, "t14-class", "8-teacher-progress", async () => {
    await page.goto(classUrl);
    await expect(page.getByText("01 王小明").first()).toBeVisible();
  });
});

test("T15 retention: Monday's weekly report, the streak freeze, all done today (P2 高中生, P4 上班族, P5 長輩)", async ({
  page,
}) => {
  // 2026-11-23 is a Monday; last week 11-16 to 11-22, 11-21 missed.
  await setToday(page, "2026-11-23");
  const time = (s: number) => ({ phone: { sintel: s } });
  await seed(page, "ll-activity:v1", {
    days: Object.fromEntries(
      [
        "2026-11-16",
        "2026-11-17",
        "2026-11-18",
        "2026-11-19",
        "2026-11-20",
        "2026-11-22",
      ].map((d) => [d, { official: false, retries: [], time: time(600) }]),
    ),
    review: {
      dragon: {
        en: "The dragon flew away.",
        zh: "龍飛走了。",
        videoId: "sintel",
        i: 0,
        stage: 0,
        due: "2026-11-19",
        at: "2026-11-18T02:00:00.000Z",
      },
    },
  });
  await signInAsAuthor(page);
  await step(page, "t15-retention", "1-home-monday", async () => {
    await page.goto("/");
    await expect(
      page.getByRole("region", { name: "上週學習報告" }),
    ).toBeVisible();
  });
  await step(page, "t15-retention", "2-dismiss", async () => {
    await page
      .getByRole("region", { name: "上週學習報告" })
      .getByRole("button", { name: "知道了" })
      .click();
  });
  await step(page, "t15-retention", "3-stats", () => page.goto("/stats"));
});

test("T16 referral: my invite link, a friend opens it (P1 國中生, P2 高中生, P3 留學生)", async ({
  page,
}) => {
  const host = `e2e-ref-host-${runId()}`;
  await signInWithEmail(page, host, `${host}@example.com`);
  await step(page, "t16-referral", "1-my-quota", async () => {
    await page.goto("/account/usage");
    await expect(page.getByRole("heading", { name: "邀請朋友" })).toBeVisible();
  });
  const link = (await page.getByTestId("referral-link").textContent()) ?? "";
  const code = /\/r\/([A-Z0-9]{8})$/.exec(link)?.[1] ?? "XXXXXXXX";
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      { name: "ll-locale", value: "zh-Hant", url: `http://localhost:${PORT}` },
    ]);
  await step(page, "t16-referral", "2-friend-opens", async () => {
    await page.goto(`/r/${code}`);
    await expect(page.getByText(/朋友邀請你一起練英文聽力/)).toBeVisible();
  });
});

test("T17 emergency switches: read-only and maintenance, as a learner sees them (管理員 Joe, P2 高中生)", async ({
  page,
  browser,
}) => {
  await signInAsAdmin(page);
  await step(page, "t17-ops", "1-admin-ops", () => page.goto("/admin/ops"));
  const learner = await browser.newContext({
    ...test.info().project.use,
    locale: "zh-TW",
  });
  await learner.addCookies([
    { name: "ll-locale", value: "zh-Hant", url: `http://localhost:${PORT}` },
  ]);
  const kid = await learner.newPage();
  await signInAsAuthor(kid);
  const toggle = async (group: string, value: "開啟" | "關閉") => {
    await page.goto("/admin/ops");
    await page.getByRole("group", { name: group }).getByText(value).click();
    await page.getByRole("button", { name: "儲存開關" }).click();
    await page.getByRole("button", { name: "確定變更" }).click();
    await expect(page.getByRole("status")).toContainText("已儲存");
  };
  try {
    await step(page, "t17-ops", "2-read-only-on", () =>
      toggle("唯讀模式", "開啟"),
    );
    await step(kid, "t17-ops", "3-learner-create-read-only", () =>
      kid.goto("/materials/new"),
    );
    await toggle("唯讀模式", "關閉");
    await step(page, "t17-ops", "4-maintenance-on", () =>
      toggle("維護模式", "開啟"),
    );
    await step(kid, "t17-ops", "5-learner-maintenance", () => kid.goto("/"));
    await step(kid, "t17-ops", "6-status", () => kid.goto("/status"));
  } finally {
    // Back to normal for everything after this.
    await fetch(
      `http://localhost:${process.env.MOCK_SUPABASE_PORT ?? 54329}/__reset-ops`,
      { method: "POST" },
    ).catch(() => {});
    await learner.close();
  }
});

test("T18 paid and free: pricing as each sees it, Plus most popular, class tiers (P4 上班族, P5 長輩, P10 老師)", async ({
  page,
}) => {
  await signInAsPaid(page);
  await step(page, "t18-pricing", "1-paid-pricing", () =>
    page.goto("/pricing"),
  );
  await signInAsLearner(page);
  await step(page, "t18-pricing", "2-free-pricing-monthly", async () => {
    await page.goto("/pricing");
    await page.getByText("月繳", { exact: true }).click();
  });
  await step(page, "t18-pricing", "3-refund", () => page.goto("/refund"));
  await step(page, "t18-pricing", "4-terms", () => page.goto("/terms"));
});
