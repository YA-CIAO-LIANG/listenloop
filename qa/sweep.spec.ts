import AxeBuilder from "@axe-core/playwright";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Browser, Page } from "@playwright/test";
import mock from "../e2e/mock-supabase/practices.json";
import { USAGE_NOTICE_COOKIE } from "../lib/notices";
import {
  setToday,
  signInAsAdmin,
  signInAsAuthor,
  signInAsPaid,
  test,
} from "../e2e/fixtures";

/**
 * The QA sweep (docs/qa-log.md): opens every page in every combination of
 * width, color scheme, and interface language, and writes what it detects
 * to qa-results/round-N/findings.jsonl, one finding per line. `npm run
 * qa:summary` groups them; Claude reviews, fixes, and runs the next round.
 */
const ROUND = process.env.QA_ROUND ?? "1";
const LIVE = !!process.env.QA_BASE_URL;
const OUT = join(process.cwd(), "qa-results", `round-${ROUND}`);
const FINDINGS = join(OUT, "findings.jsonl");

const WIDTHS = [360, 375, 414, 768, 1280] as const;
const SCHEMES = ["light", "dark"] as const;
const LOCALES = ["zh-Hant", "en"] as const;
/** Phones (touch) need 44 px targets; larger screens WCAG 2.5.8's 24 px. */
const PHONE_MAX = 414;
/** Slower than this to load (the E2E build on this machine) is a finding. */
const SLOW_MS = 3000;

type Role = "none" | "author" | "admin" | "paid";
/** Something to do on the page before checking it (an open panel, a step). */
type Step = (page: Page) => Promise<void>;
const ready = mock.ready.id;
/** Someone else's shared practice: a preview when signed out (D106). */
const shared = mock.shared.id;
const PAGES: { path: string; role: Role; state?: string; then?: Step }[] = [
  ...[
    "/",
    "/explore",
    "/level-test",
    "/pricing",
    "/refund",
    "/terms",
    "/privacy",
    "/credits",
    "/feedback",
    "/videos/sintel",
    "/videos/sintel/day/1",
    "/videos/sintel/handout",
    "/stats",
    "/practices",
    "/offline",
    "/checkout/failed",
    "/login",
    "/pricing/classroom",
    "/classroom/join/ABCD2345",
    ...(LIVE ? [] : [`/videos/p-${shared}`]),
    "/no-such-page",
  ].map((path) => ({ path, role: "none" as const })),
  ...(LIVE
    ? []
    : [
        ...[
          "/",
          "/practices",
          "/stats",
          "/materials",
          "/materials/new",
          "/account",
          "/review",
          `/videos/p-${ready}`,
          `/videos/p-${ready}/day/1`,
          `/videos/p-${ready}/day/2`,
          `/materials/${ready}/edit`,
          "/classroom",
        ].map((path) => ({ path, role: "author" as const })),
        ...[
          "/admin",
          "/admin/usage",
          "/admin/official",
          "/admin/revenue",
          "/admin/users",
          "/admin/materials",
          "/admin/reports",
          "/admin/errors",
          "/admin/events",
          "/admin/feedback",
          "/admin/audit",
          "/admin/sentences",
          "/admin/interest",
          "/admin/forecast",
          "/admin/retention",
          "/admin/docs",
          "/admin/docs?doc=user&lang=en",
          "/classroom",
        ].map((path) => ({ path, role: "admin" as const })),
        // States behind a click: forms past their first step.
        // An admin: the author's one-practice trial is used up (D72), so
        // their create page has no form to open.
        {
          path: "/materials/new",
          role: "admin" as const,
          state: "ai-panel",
          then: async (page: Page) => {
            await page.getByText(/^(AI 生成|Write with AI)$/).click();
          },
        },
        {
          path: "/materials/new",
          role: "paid" as const,
          state: "youtube-review",
          then: async (page: Page) => {
            await page.getByText(/^(YouTube 連結|YouTube link)$/).click();
            await page
              .getByLabel(/YouTube 影片連結|YouTube video link/)
              .fill("ccVideo0001");
            await page
              .getByRole("button", { name: /讀取影片|Read the video/ })
              .click();
            await page
              .getByLabel(/字幕記錄|Transcript/)
              .fill(
                "0:01\nso how does\n0:03\nsleep work?\n0:05\nLet's find out.",
              );
            await page
              .getByRole("button", { name: /斷句並翻譯|Split and translate/ })
              .click();
            await page.getByText("0:01–0:04").waitFor();
          },
        },
        { path: "/videos/sintel", role: "paid" as const },
      ]),
];

type Finding = {
  kind:
    | "overlap"
    | "truncated"
    | "overflow"
    | "smallTarget"
    | "axe"
    | "console"
    | "pageError"
    | "slow"
    | "brokenLink"
    | "status";
  detail: string;
};

/** Layout checks that run inside the page. */
function inspect(minTarget: number) {
  const label = (el: Element) => {
    const text = (
      (el as HTMLElement).innerText ||
      el.getAttribute("aria-label") ||
      el.getAttribute("alt") ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 40);
    const cls = String(el.getAttribute("class") ?? "")
      .split(" ")
      .slice(0, 3)
      .join(".");
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""} "${text}"`;
  };
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return false;
    // Inside a closed <details> (other than its summary): not shown.
    const details = el.closest("details:not([open])");
    if (details && !el.closest("summary")) return false;
    for (let e: Element | null = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.visibility === "hidden" || s.opacity === "0") return false;
      if (s.display === "none") return false;
    }
    return true;
  };
  const floating = (el: Element) => {
    for (let e: Element | null = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.position === "fixed" || s.position === "sticky") return true;
      if (e.getAttribute("role") === "tooltip") return true;
    }
    return false;
  };
  const findings: { kind: string; detail: string }[] = [];
  const width = document.documentElement.clientWidth;

  // Overlapping elements: neither contains the other, and they cover a
  // noticeable part of the smaller one.
  const pieces = [
    ...document.querySelectorAll(
      "a[href], button, input:not([type=hidden]), select, textarea, h1, h2, h3, h4, p, img, label, [role=button], th, td > *",
    ),
  ].filter((el) => visible(el) && !floating(el));
  // An inline element that wraps has one box per line; its bounding box
  // would cover the lines' whole width.
  const boxes = pieces.map((el) =>
    getComputedStyle(el).display === "inline"
      ? [...el.getClientRects()]
      : [el.getBoundingClientRect()],
  );
  const overlap = (a: DOMRect, b: DOMRect) => {
    const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (x <= 1 || y <= 1) return null;
    const smaller = Math.min(a.width * a.height, b.width * b.height);
    return x * y >= 16 && x * y >= 0.15 * smaller ? [x, y] : null;
  };
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i];
      const b = pieces[j];
      if (a.contains(b) || b.contains(a)) continue;
      const hit = boxes[i]
        .flatMap((ra) => boxes[j].map((rb) => overlap(ra, rb)))
        .find(Boolean);
      if (hit) {
        findings.push({
          kind: "overlap",
          detail: `${label(a)} × ${label(b)} (${Math.round(hit[0])}×${Math.round(hit[1])})`,
        });
      }
    }
  }

  // Text cut off: clipped horizontally, an ellipsis, or a line clamp.
  for (const el of document.querySelectorAll("main *, header *, footer *")) {
    if (
      !visible(el) ||
      ["INPUT", "TEXTAREA", "SELECT", "svg"].includes(el.tagName)
    )
      continue;
    const s = getComputedStyle(el);
    if (s.overflowX === "auto" || s.overflowX === "scroll") continue;
    const h = el as HTMLElement;
    if (!h.innerText?.trim()) continue;
    const clippedX =
      s.overflowX !== "visible" && h.scrollWidth > h.clientWidth + 1;
    const clamped =
      s.webkitLineClamp !== "none" &&
      s.webkitLineClamp !== "" &&
      h.scrollHeight > h.clientHeight + 1;
    if (clippedX || clamped) {
      findings.push({
        kind: "truncated",
        detail: `${label(el)}${clamped ? " (line clamp)" : ""}`,
      });
    }
  }

  // Wider than the screen.
  if (document.documentElement.scrollWidth > width + 1) {
    const wide = [...document.querySelectorAll("body *")]
      .filter(
        (el) => el.getBoundingClientRect().right > width + 1 && visible(el),
      )
      .filter(
        (el) =>
          !el.parentElement ||
          el.parentElement.getBoundingClientRect().right <= width + 1,
      )
      .slice(0, 3)
      .map(
        (el) =>
          `${label(el)} → ${Math.round(el.getBoundingClientRect().right)}`,
      );
    findings.push({
      kind: "overflow",
      detail: `page ${document.documentElement.scrollWidth}px: ${wide.join("; ")}`,
    });
  }

  // Touch targets.
  for (const el of document.querySelectorAll(
    "a[href], button, input:not([type=hidden]), select, textarea, [role=button]",
  )) {
    if (!visible(el)) continue;
    // Links inside running text are exempt (WCAG 2.5.8).
    if (el.tagName === "A" && el.closest("p, li")) continue;
    const box = (el.closest("label") ?? el).getBoundingClientRect();
    // The calendar's 7 columns can't wrap; 36 px+ is accepted (D88).
    const calendarDay =
      el.closest("#practice-calendar-days") && box.width >= 36;
    if (!calendarDay && (box.width < minTarget || box.height < minTarget)) {
      findings.push({
        kind: "smallTarget",
        detail: `${label(el)} ${Math.round(box.width)}×${Math.round(box.height)}`,
      });
    }
  }

  const links = [...document.querySelectorAll("a[href]")]
    .map((a) => (a as HTMLAnchorElement).href)
    .filter((href) => href.startsWith(location.origin));
  return { findings, links: [...new Set(links)] };
}

async function signIn(page: Page, role: Role) {
  if (role === "author") await signInAsAuthor(page);
  if (role === "admin") await signInAsAdmin(page);
  if (role === "paid") await signInAsPaid(page);
}

async function open(browser: Browser, combo: Combo, role: Role) {
  const phone = combo.width <= PHONE_MAX;
  const context = await browser.newContext({
    viewport: { width: combo.width, height: phone ? 800 : 900 },
    hasTouch: phone,
    isMobile: phone,
    colorScheme: combo.scheme,
    locale: combo.locale === "en" ? "en-US" : "zh-TW",
    timezoneId: "Asia/Taipei",
    baseURL: process.env.QA_BASE_URL ?? "http://localhost:3200",
  });
  const host = new URL(
    process.env.QA_BASE_URL ?? "http://localhost:3200",
  ).toString();
  // The usage notice dismissed, as a returning visitor would have it.
  await context.addCookies([
    { name: "ll-locale", value: combo.locale, url: host },
    { name: USAGE_NOTICE_COOKIE, value: "1", url: host },
  ]);
  await context.route(
    /youtube(-nocookie)?\.com|ytimg\.com|googlevideo\.com/,
    (route) => route.abort(),
  );
  const page = await context.newPage();
  if (!LIVE) await setToday(page, "2026-11-18");
  await signIn(page, role);
  return { context, page };
}

type Combo = {
  width: (typeof WIDTHS)[number];
  scheme: (typeof SCHEMES)[number];
  locale: (typeof LOCALES)[number];
};
const COMBOS: Combo[] = WIDTHS.flatMap((width) =>
  SCHEMES.flatMap((scheme) =>
    LOCALES.map((locale) => ({ width, scheme, locale })),
  ),
);

// Pages with a step (an open form) take longer for 20 combinations.
test.setTimeout(1_200_000);

for (const { path, role, state, then } of PAGES) {
  const name = state ? `${path}#${state}` : path;
  test(`${role} ${name}`, async ({ browser }) => {
    mkdirSync(OUT, { recursive: true });
    const record = (combo: Combo, finding: Finding) =>
      appendFileSync(
        FINDINGS,
        JSON.stringify({ page: name, role, ...combo, ...finding }) + "\n",
      );
    const linkSet = new Set<string>();

    for (const combo of COMBOS) {
      const { context, page } = await open(browser, combo, role);
      // YouTube is blocked on purpose; the stand-in Supabase refuses writes
      // it doesn't know (401), and the 404 page answers 404.
      const ignore = LIVE
        ? /youtube|ytimg|googlevideo|ERR_FAILED|ERR_BLOCKED/i
        : /youtube|ytimg|googlevideo|ERR_FAILED|ERR_BLOCKED|status of 40[14]/i;
      page.on("console", (message) => {
        if (message.type() === "error" && !ignore.test(message.text())) {
          record(combo, {
            kind: "console",
            detail: message.text().slice(0, 200),
          });
        }
      });
      page.on("pageerror", (error) =>
        record(combo, {
          kind: "pageError",
          detail: error.message.slice(0, 200),
        }),
      );
      const started = Date.now();
      const response = await page
        .goto(path, { waitUntil: "load" })
        .catch(() => null);
      const took = Date.now() - started;
      const expected = path === "/no-such-page" ? 404 : 200;
      if (response && response.status() !== expected) {
        record(combo, { kind: "status", detail: String(response.status()) });
      }
      if (took > SLOW_MS) record(combo, { kind: "slow", detail: `${took} ms` });
      await page.waitForLoadState("networkidle").catch(() => {});
      if (then) {
        await then(page).catch((error: Error) =>
          record(combo, {
            kind: "status",
            detail: `step failed: ${error.message.slice(0, 150)}`,
          }),
        );
      }
      const minTarget = combo.width <= PHONE_MAX ? 44 : 24;
      const { findings, links } = await page.evaluate(inspect, minTarget);
      for (const finding of findings) record(combo, finding as Finding);
      links.forEach((link) => linkSet.add(link));

      // Two screenshots per page for a look by eye.
      const shot =
        (combo.width === 375 &&
          combo.scheme === "light" &&
          combo.locale === "zh-Hant") ||
        (combo.width === 1280 &&
          combo.scheme === "dark" &&
          combo.locale === "en");
      if (shot) {
        const name = `${role}${path.replaceAll("/", "_") || "_"}--${combo.width}-${combo.scheme}-${combo.locale}.png`;
        await page.screenshot({
          path: join(OUT, "shots", name),
          fullPage: true,
        });
      }

      if (combo.width === 375 || combo.width === 1280) {
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .exclude("iframe")
          .analyze()
          .catch(() => null);
        for (const v of axe?.violations ?? []) {
          record(combo, {
            kind: "axe",
            detail: `${v.id}: ${v.nodes
              .slice(0, 3)
              .map((n) => n.target.join(" "))
              .join(" | ")}`,
          });
        }
      }
      await context.close();
    }

    // Links on the page (any combination), checked once.
    const { context, page } = await open(browser, COMBOS[0], role);
    const here = new URL(path, "http://x").pathname;
    for (const link of linkSet) {
      if (new URL(link).pathname === here) continue; // e.g. the skip link
      const status = await page.request
        .get(link, { maxRedirects: 5 })
        .then((r) => r.status())
        .catch(() => 0);
      if (status >= 400 || status === 0) {
        appendFileSync(
          FINDINGS,
          JSON.stringify({
            page: path,
            role,
            kind: "brokenLink",
            detail: `${link} → ${status}`,
          }) + "\n",
        );
      }
    }
    await context.close();
  });
}
