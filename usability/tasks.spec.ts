import AxeBuilder from "@axe-core/playwright";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import mock from "../e2e/mock-supabase/practices.json";
import sintel from "../data/videos/sintel.json";
import {
  expect,
  setToday,
  signInAsAuthor,
  signInAsBuyer,
  signInAsLearner,
  test,
} from "../e2e/fixtures";

/**
 * The AI usability test's tasks (docs/usability-ai-test.md): each step
 * takes a screenshot and measures the page, so Claude can review it as
 * the personas in docs/personas.md. A step that can't be done is
 * recorded as a failure of the task, not of the run.
 */
const ROUND = process.env.USABILITY_ROUND ?? "1";

// Generous: a slow step is a finding, not a crash of the run.
test.setTimeout(120_000);
const OUT = join(process.cwd(), "usability-results", `round-${ROUND}`);

type Measure = {
  overflow: boolean;
  wide: string[];
  smallTargets: string[];
  aboveFoldChars: number;
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
      const text = (document.querySelector("main")?.innerText ?? "").trim();
      const paragraphs = [...document.querySelectorAll("main p")].map(
        (p) => (p as HTMLElement).innerText.length,
      );
      const sentences = text
        .split(/[。！？!?\n]|\.\s/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1);
      let above = 0;
      const walker = document.createTreeWalker(
        document.querySelector("main") ?? document.body,
        NodeFilter.SHOW_TEXT,
      );
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;
        if (!parent || !visible(parent)) continue;
        if (parent.getBoundingClientRect().top < window.innerHeight) {
          above += (node.textContent ?? "").trim().length;
        }
      }
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
        aboveFoldChars: above,
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
  action: () => Promise<void>,
) {
  const project = test.info().project.name;
  const dir = join(OUT, project);
  mkdirSync(dir, { recursive: true });
  const started = Date.now();
  let error: string | null = null;
  try {
    await action();
    await page.waitForLoadState("networkidle").catch(() => {});
  } catch (e) {
    error = (e as Error).message.split("\n")[0];
  }
  const file = `${task}--${name}.png`;
  await page.screenshot({ path: join(dir, file), fullPage: true });
  const metrics = await measure(page, project === "phone");
  appendFileSync(
    join(OUT, "metrics.jsonl"),
    JSON.stringify({
      project,
      task,
      step: name,
      url: new URL(page.url()).pathname,
      ms: Date.now() - started,
      error,
      file: `${project}/${file}`,
      ...metrics,
    }) + "\n",
  );
}

const official = mock.official;
const shared = mock.ready;
const firstSentences = sintel.sentences.slice(0, 3);

/** Day 1 done yesterday: the handout opens, Day 2 is today's task. */
const dayOneDone = {
  videoId: "sintel",
  week: 1,
  startedAt: "2026-11-01",
  days: {
    1: {
      done: true,
      score: 0.72,
      date: "2026-11-01",
      answers: sintel.sentences.map((s) => s.en),
    },
  },
  status: "in-progress",
  history: [],
};
const withProgress = (page: Page) =>
  page.addInitScript((value) => {
    window.localStorage.setItem("ll-progress:v1:sintel", value);
  }, JSON.stringify(dayOneDone));

test("T1 home, first visit (國中生, 長輩)", async ({ page }) => {
  await setToday(page, "2026-11-02");
  await step(page, "t1-home", "1-first-visit", () =>
    page.goto("/").then(() => {}),
  );
  await step(page, "t1-home", "2-skip-guide", async () => {
    await page
      .getByRole("button", { name: /略過|知道了/ })
      .first()
      .click();
  });
});

test("T2 how many minutes today (上班族)", async ({ page }) => {
  await setToday(page, "2026-11-02");
  await page.goto("/");
  await step(page, "t2-minutes", "1-pick-10-min", async () => {
    await page
      .getByRole("group", { name: "我今天有幾分鐘？" })
      .getByRole("button", { name: /10 分鐘內/ })
      .click();
  });
});

test("T3 dictation, first sentences (高中生)", async ({ page }) => {
  await setToday(page, "2026-11-01");
  await step(page, "t3-dictation", "1-open", () =>
    page.goto("/videos/sintel/day/1").then(() => {}),
  );
  const input = page.getByRole("textbox", { name: "你聽到的句子" });
  for (const [i, sentence] of firstSentences.entries()) {
    // A learner gets most words: drop the last one.
    const answer = sentence.en.split(" ").slice(0, -1).join(" ");
    await step(page, "t3-dictation", `${i + 2}-sentence-${i + 1}`, async () => {
      await input.fill(answer);
      await page.getByRole("button", { name: "送出" }).click();
      await expect(page.getByText(/這句正確率/)).toBeVisible();
    });
    await page.getByRole("button", { name: "下一句" }).click();
  }
});

test("T4 handout and PDF (留學生)", async ({ page }) => {
  await setToday(page, "2026-11-02");
  await withProgress(page);
  await step(page, "t4-handout", "1-open", () =>
    page.goto("/videos/sintel/handout").then(() => {}),
  );
  await step(page, "t4-handout", "2-print-view", async () => {
    await page.emulateMedia({ media: "print" });
  });
});

test("T5 shadowing (高中生, 無障礙)", async ({ page }) => {
  await setToday(page, "2026-11-02");
  await withProgress(page);
  await step(page, "t5-shadowing", "1-open-day-2", () =>
    page.goto("/videos/sintel/day/2").then(() => {}),
  );
  await step(page, "t5-shadowing", "2-keyboard-first-tab", async () => {
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
  });
});

test("T6 stats (上班族)", async ({ page }) => {
  await signInAsAuthor(page);
  await setToday(page, "2026-11-02");
  await withProgress(page);
  await step(page, "t6-stats", "1-open", () =>
    page.goto("/stats").then(() => {}),
  );
});

test("T7 create with AI (留學生)", async ({ page }) => {
  await signInAsLearner(page);
  await step(page, "t7-create", "1-open", () =>
    page.goto("/materials/new").then(() => {}),
  );
  await step(page, "t7-create", "2-ai-form", async () => {
    await page.getByText("AI 生成").click();
  });
  await step(page, "t7-create", "3-generate", async () => {
    await page.getByLabel(/想練什麼/).fill("跟室友討論打掃分工");
    await page.getByRole("button", { name: "生成文字" }).click();
    await expect(page.getByLabel("文字內容")).not.toHaveValue("");
  });
});

test("T8 report a shared practice (國中生)", async ({ page }) => {
  await signInAsLearner(page);
  await step(page, "t8-report", "1-open-practice", () =>
    page.goto(`/videos/p-${shared.id}`).then(() => {}),
  );
  await step(page, "t8-report", "2-open-report", async () => {
    await page.getByRole("button", { name: "檢舉這份練習" }).click();
  });
});

test("T9 bilingual titles in the library (英文介面)", async ({
  page,
  context,
}) => {
  await step(page, "t9-titles", "1-library-zh", () =>
    page.goto("/explore").then(() => {}),
  );
  await context.addCookies([
    { name: "ll-locale", value: "en", url: "http://localhost:3200" },
  ]);
  await step(page, "t9-titles", "2-home-en", () =>
    page.goto("/").then(() => {}),
  );
  await step(page, "t9-titles", "3-official-practice", () =>
    page.goto(`/videos/p-${official.id}`).then(() => {}),
  );
});

test("T10 pricing and checkout (上班族, 長輩)", async ({ page }) => {
  await signInAsBuyer(page, `usability-${test.info().project.name}`);
  await step(page, "t10-pay", "1-pricing", () =>
    page.goto("/pricing").then(() => {}),
  );
  await step(page, "t10-pay", "2-checkout", async () => {
    await page.getByRole("button", { name: /^訂閱/ }).click();
    await expect(page.getByRole("heading", { name: "測試結帳" })).toBeVisible();
  });
  await step(page, "t10-pay", "3-paid", async () => {
    await page.getByRole("button", { name: "模擬付款成功" }).click();
    await expect(page.getByRole("heading", { name: "付款完成" })).toBeVisible();
  });
  await step(page, "t10-pay", "4-account", async () => {
    await page.getByRole("link", { name: "查看訂閱" }).click();
  });
});

test("T11 large text (長輩): home at 200% zoom", async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    });
  });
  await step(page, "t11-zoom", "1-home-200", () =>
    page.goto("/").then(() => {}),
  );
});
