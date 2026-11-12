---
name: qa-sweep
description: Run ListenLoop's QA sweep — Playwright opens every page at 360, 375, 414, 768, and 1280 px, light and dark, Chinese and English, and detects overlapping elements, cut-off text, pages wider than the screen, touch targets under 44 px (phones) or 24 px, axe contrast and WCAG 2.1 AA violations, browser errors, broken links, and slow loads; Claude fixes what's real, opens a PR per round, re-runs, and logs each round in docs/qa-log.md. Fake providers only. Use when Joe asks 「品質檢查」「QA」「qa-sweep」「逐頁檢查」.
---

# QA sweep

Never calls a paid API: it uses the E2E build (stand-in Supabase, fake AI and payment providers). Write the log in 繁體中文.

## Run a round

```sh
npm run build:e2e                 # after any code change
QA_ROUND=1 npm run qa             # ~6 minutes, 74 pages × 20 combinations
QA_ROUND=1 npm run qa:summary     # grouped findings
```

- Findings land in `qa-results/round-N/findings.jsonl` (git-ignored), one line per finding with the page, role, width, scheme, locale, kind, and detail.
- **Four kinds of visitor**, each its own role: `none` (signed out), `learner` (free plan, no materials yet), `author` (free plan with materials), `paid` (Plus), `admin`. Add a page under every role that sees it differently.
- **Only one round at a time.** Two rounds (or a round and `npm run test:e2e`) share port 3200; when one ends it stops the server and the other reports pages without `lang`, tiny targets, and refused connections (round 48). Check the port is free first: `lsof -ti:3200`.
- A change that only shows with a setting (for example the cookie notice with `NEXT_PUBLIC_CLARITY_PROJECT_ID`): build with it set (`NEXT_PUBLIC_CLARITY_PROJECT_ID=abc123xyz npm run build:e2e`) for one round, then rebuild without it.
- The live site, signed-out pages only: `QA_BASE_URL=https://listenloop-three.vercel.app QA_ROUND=live1 npm run qa` (read-only; no clock override).
- Pages and checks are in `qa/sweep.spec.ts`; add a page there when a route is added.

## What each kind means

| Kind                   | Detected by                                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `overlap`              | two visible elements (buttons, links, inputs, headings, paragraphs, images, cells) cover ≥ 15% of the smaller one, neither inside the other; fixed, sticky, and tooltip layers are skipped; wrapped inline links compare line by line |
| `truncated`            | text clipped horizontally (`overflow` hidden with `scrollWidth > clientWidth`) or by a line clamp                                                                                                                                     |
| `overflow`             | the page is wider than the screen; lists the outermost elements sticking out                                                                                                                                                          |
| `smallTarget`          | a control under 44 px on phones (≤ 414 px, touch) or 24 px otherwise; links inside running text are exempt (WCAG 2.5.8)                                                                                                               |
| `axe`                  | WCAG 2.1 AA rules at 375 and 1280 px, including `color-contrast`                                                                                                                                                                      |
| `console`, `pageError` | browser errors (YouTube, blocked on purpose, and the stand-in's 401/404 are ignored)                                                                                                                                                  |
| `brokenLink`           | an internal link on the page answers ≥ 400                                                                                                                                                                                            |
| `status`, `slow`       | the page didn't answer 200 (404 for `/no-such-page`), or took over 3 s to load                                                                                                                                                        |

## Review

1. Summarize, then look at each distinct finding. **Check before fixing**: open the page (or a screenshot) at the width that flagged it.
2. **Known artifacts** (don't fix, note in the log):
   - the stand-in Supabase ignores some filters, so admin pages may list (and link to) private practices that 404;
   - Playwright's touch emulation draws a grey dot where it tapped;
   - the practice calendar's day buttons are 40–42 px at 360–375 px by design (D88).
3. Fix real ones on a `fix/qa-round-N` branch, following CLAUDE.md (design tokens, text from `messages/`, tests, decisions).
4. Rebuild, run the next round, and repeat until a round finds nothing new or the time box ends.

## After every change: the flows

The sweep looks at pages; these E2E files walk the flows that broke before. Run them with the sweep after every change (all of `npm run test:e2e` does), and add to them when a flow changes:

| File                                            | What it walks                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `e2e/roles.spec.ts`                             | each kind of visitor's main path: signed out, free, paid, admin                                   |
| `e2e/account-switch.spec.ts`                    | sign out, sign in as someone else: nothing of the first account stays (D138)                      |
| `e2e/time-zones.spec.ts`                        | Taipei, US Central, US Pacific at the same instant: today, unlocking, reviews (D139)              |
| `e2e/mobile-devices.spec.ts`                    | iPhone 15 and Pixel 7 (touch, phone UA) for each role, and coming back from Google sign-in (D140) |
| `e2e/shadowing-phone.spec.ts`                   | the phone's bottom bar: Next, I said it, Play in the same place every sentence (D141)             |
| `e2e/full-week.spec.ts`                         | one material from Day 1 to Day 7 and the week's result, on a desktop and a phone                  |
| `e2e/level-test.spec.ts`                        | the level test, its rule, and the library's starting level (D146)                                 |
| `e2e/review.spec.ts`                            | a misheard word the next day: sound, loop, notes, where it's from (D145)                          |
| `e2e/materials-folders.spec.ts`                 | My materials: folders, move by menu and by drag, grid and list (D147)                             |
| `e2e/plans.spec.ts`, `e2e/student-plan.spec.ts` | the free plan's week, the student plan (D143, D144)                                               |

## Log

Append a round to `docs/qa-log.md`: start time, findings by kind (distinct), what was fixed (with PR), what was an artifact or accepted, and what's left.
