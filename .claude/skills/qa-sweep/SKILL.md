---
name: qa-sweep
description: Run ListenLoop's QA sweep — Playwright opens every page at 360, 375, 414, 768, and 1280 px, light and dark, Chinese and English, and detects overlapping elements, cut-off text, pages wider than the screen, touch targets under 44 px (phones) or 24 px, axe contrast and WCAG 2.1 AA violations, browser errors, broken links, and slow loads; Claude fixes what's real, opens a PR per round, re-runs, and logs each round in docs/qa-log.md. Fake providers only. Use when Joe asks 「品質檢查」「QA」「qa-sweep」「逐頁檢查」.
---

# QA sweep

Never calls a paid API: it uses the E2E build (stand-in Supabase, fake AI and payment providers). Write the log in 繁體中文.

## Run a round

```sh
npm run build:e2e                 # after any code change
QA_ROUND=1 npm run qa             # ~5 minutes, 38 pages × 20 combinations
QA_ROUND=1 npm run qa:summary     # grouped findings
```

- Findings land in `qa-results/round-N/findings.jsonl` (git-ignored), one line per finding with the page, role (signed out, author, admin), width, scheme, locale, kind, and detail.
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

## Log

Append a round to `docs/qa-log.md`: start time, findings by kind (distinct), what was fixed (with PR), what was an artifact or accepted, and what's left.
