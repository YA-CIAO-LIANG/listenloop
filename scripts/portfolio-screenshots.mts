/**
 * Portfolio screenshots of the live site (docs/portfolio/screenshots/):
 * home, library, a dictation result with its highlights, the handout,
 * learning analytics, creating a material, and the admin overview, on a
 * phone and a laptop, light and dark.
 *
 *   npm run portfolio:screenshots
 *
 * Signed-out pages use progress written into this browser only. Signed-in
 * pages use a temporary account (made with the secret key, given the admin
 * role for the overview, and deleted at the end with everything it
 * synced). Read-only otherwise; no paid API is called.
 */
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const BASE =
  process.env.PORTFOLIO_BASE_URL ?? "https://listenloop-three.vercel.app";
const OUT = "docs/portfolio/screenshots";
/** An official audio material with version 2 notes: "Platform and Delay". */
const PRACTICE = "p-bea5f4da-9182-45ad-9c46-3a6832250332";

const VIEWPORTS = {
  phone: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  laptop: { viewport: { width: 1366, height: 860 }, deviceScaleFactor: 2 },
} as const;
const SCHEMES = ["light", "dark"] as const;

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

/** Day 1 done with a few believable mistakes, and older finished weeks. */
function seededStorage(
  userId: string | null,
  sentences: string[],
): Record<string, string> {
  const answers = sentences.map((en) =>
    en
      .toLowerCase()
      .replace(/[^\p{L}\p{N}' ]/gu, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
  // Mistakes a learner really makes: weak forms and linking.
  answers[1] = "sure one single and one returned or both singles";
  answers[3] =
    "right next train to meadow junction leave at nine thirty from platform four";
  answers[5] =
    "it is a stopping service it will call at three intermediate station";
  const progress = {
    videoId: PRACTICE,
    week: 1,
    startedAt: daysAgo(2),
    days: {
      "1": {
        done: true,
        score: 0.86,
        weightedScore: 0.86,
        date: daysAgo(2),
        answers,
        speeds: answers.map(() => 1),
      },
    },
    status: "in-progress",
    history: [],
  };
  const sintel = {
    videoId: "sintel",
    week: 2,
    startedAt: daysAgo(9),
    days: Object.fromEntries(
      [1, 2, 3, 4, 5, 6, 7].map((day) => [
        String(day),
        day === 1 || day === 7
          ? {
              done: true,
              score: day === 1 ? 0.62 : 0.88,
              weightedScore: day === 1 ? 0.62 : 0.88,
              date: daysAgo(16 - day),
              answers: [],
            }
          : { done: true, date: daysAgo(16 - day), sentences: [] },
      ]),
    ),
    status: "passed",
    history: [
      {
        week: 1,
        startedAt: daysAgo(16),
        day1Score: 0.62,
        day7Score: 0.88,
        passed: true,
      },
    ],
  };
  // Two weeks of practice up to today, 8 to 20 minutes a day.
  const tasks = Object.fromEntries(
    Array.from({ length: 15 }, (_, k) => {
      const videoId = k < 3 ? PRACTICE : "sintel";
      return [
        daysAgo(k),
        {
          official: true,
          retries: [],
          tasks: [{ videoId, week: 1, day: (k % 7) + 1 }],
          time: { "portfolio-device": { [videoId]: 480 + ((k * 137) % 720) } },
        },
      ];
    }),
  );
  return {
    [`ll-progress:v1:${PRACTICE}`]: JSON.stringify(progress),
    "ll-progress:v1:sintel": JSON.stringify(sintel),
    "ll-activity:v1": JSON.stringify({ days: tasks }),
    // Seen the tips and the tour already.
    ...(userId
      ? { "ll-account:v1": JSON.stringify({ userId, synced: [] }) }
      : {}),
  };
}

async function seed(page: Page, storage: Record<string, string>) {
  await page.goto(`${BASE}/terms`);
  await page.evaluate((items) => {
    for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
  }, storage);
}

async function shoot(page: Page, name: string, scrollTo?: string) {
  if (scrollTo) {
    await page.locator(scrollTo).first().waitFor();
    await page.evaluate((selector) => {
      const top = document.querySelector(selector)!.getBoundingClientRect().top;
      window.scrollTo({ top: window.scrollY + top - 16, behavior: "instant" });
    }, scrollTo);
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${name}.png`);
}

const env = (n: string) => process.env[n]?.trim() ?? "";
const admin = createClient(
  env("NEXT_PUBLIC_SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: { persistSession: false },
  },
);
const email = `portfolio-${Date.now()}@example.com`;
const password = `${crypto.randomUUID()}-Aa1`;
const { data: created, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (error) throw error;
const userId = created.user.id;
const { data: rows } = await admin
  .from("practice_sentences")
  .select("i, en")
  .eq("practice_id", PRACTICE.slice(2))
  .order("i");
const sentences = (rows ?? []).map((r) => r.en as string);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  // The admin overview needs the admin role; the profile is made on sign-up.
  for (let k = 0; k < 10; k += 1) {
    const { data } = await admin
      .from("profiles")
      .update({ role: "admin" })
      .eq("user_id", userId)
      .select("user_id");
    if (data?.length) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  for (const [device, viewport] of Object.entries(VIEWPORTS)) {
    for (const scheme of SCHEMES) {
      console.log(`${device} ${scheme}`);
      const tag = `${device}-${scheme}`;
      const context = await browser.newContext({
        ...viewport,
        colorScheme: scheme,
        locale: "zh-TW",
      });
      const page = await context.newPage();
      // The usage tip and the first-visit tour were dismissed already.
      const dismissed = ["ll-usage-notice", "ll-onboarding"].map((name) => ({
        name,
        value: "1",
        url: BASE,
      }));
      await context.addCookies(dismissed);
      // Signed out.
      await page.goto(BASE);
      await shoot(page, `01-home-${tag}`);
      await shoot(page, `02-library-${tag}`, "#library");
      await seed(page, seededStorage(null, sentences));
      await page.goto(`${BASE}/videos/${PRACTICE}/day/1`);
      await page.waitForTimeout(2500);
      await shoot(page, `03-dictation-result-${tag}`, "main li:nth-of-type(2)");
      await page.goto(`${BASE}/videos/${PRACTICE}/handout`);
      await shoot(page, `04-handout-${tag}`);
      // Signed in (a fresh context, so this browser's data syncs to the
      // temporary account only).
      const signed = await browser.newContext({
        ...viewport,
        colorScheme: scheme,
        locale: "zh-TW",
      });
      await signed.addCookies(dismissed);
      const p2 = await signed.newPage();
      await p2.goto(`${BASE}/login`);
      await p2.getByLabel("Email", { exact: true }).fill(email);
      await p2.getByLabel("密碼", { exact: true }).fill(password);
      await p2.getByRole("button", { name: "登入", exact: true }).click();
      await p2.waitForURL((url) => !url.pathname.startsWith("/login"), {
        timeout: 20_000,
      });
      await seed(p2, seededStorage(userId, sentences));
      await p2.goto(`${BASE}/stats`);
      await p2.waitForTimeout(1500);
      await shoot(p2, `05-analytics-${tag}`);
      await p2.goto(`${BASE}/materials/new`);
      await shoot(p2, `06-create-${tag}`);
      await p2.goto(`${BASE}/admin`);
      await shoot(p2, `07-admin-${tag}`);
      await signed.close();
      await context.close();
    }
  }
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(userId);
  console.log("temporary account deleted");
}
