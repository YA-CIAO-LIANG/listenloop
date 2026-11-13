---
name: ai-usability-test
description: Run ListenLoop's AI usability test — Claude walks the main tasks as the personas in docs/personas.md (國中生, 高中生, 留學生, 上班族, 長輩, 無障礙, 英文介面, 高三生, 在美國的研究生, 補習班老師) through whole flows as a guest, free, paid, and admin account, with Playwright on two emulated phones (iPhone 15, Pixel 7) and a laptop (1280 px), reads the screenshots and measurements, rates problems on Nielsen's 0–4 scale, fixes severity 3–4 (and small 2s) for up to 3 rounds, and updates docs/usability-ai-test.md. Fake providers only, no paid API. Use when Joe asks 「AI 模擬使用者測試」「可用性測試」「usability test」.
---

# AI usability test

Never calls a paid API: the run uses the E2E build (stand-in Supabase, fake AI and payment providers). Write the report in 繁體中文.

## Run a round

```sh
npm run build:e2e                       # after any code change
USABILITY_ROUND=1 npm run usability     # all tasks, iPhone 15 + Pixel 7 + desktop (D170)
```

Output in `usability-results/round-N/` (git-ignored):

- `iphone15/`, `pixel7/`, `desktop/`: one full-page screenshot per step, `<task>--<step>.png`;
- `metrics.jsonl`: one line per step, with
  - `error` (the step couldn't be done);
  - `overflow` and `wide` (elements sticking out);
  - `smallTargets` (< 44 px on phones, < 24 px on desktop);
  - `aboveFoldChars`, `aboveFoldText` (the first screen's words, for the five-second test), `h1`, `longestParagraph`, `avgSentenceChars`;
  - `axe` (WCAG 2.1 AA rule ids).

Summarize the metrics first:

```sh
python3 -c "import json;[print(m['project'],m['task'],m['step'],m['error'],m['overflow'],m['wide'][:2],m['axe'],m['smallTargets'][:3]) for m in map(json.loads,open('usability-results/round-1/metrics.jsonl'))]"
```

## Review

1. **Check flagged steps first**: an error, overflow, axe violations, or small targets.
2. **Read the screenshots with the Read tool**:
   - every new or changed page;
   - the phone versions of the home, practice, create, and pricing pages.
   - Long screenshots can be cropped with `ffmpeg -i in.png -vf "crop=<w>:<h>:0:<y>,scale=400:-1" out.png` (phone screenshots are at 3× or 2.625×; `sips --cropOffset` ignores the offset).
3. **For each task, think aloud as the persona(s) named in its test title** (`docs/personas.md`): what they expect, what they see, where they hesitate.
4. **Record each problem**:
   - a number (F1…);
   - the task and persona;
   - a one-line think-aloud quote;
   - the Nielsen heuristic (or the WCAG criterion);
   - the severity:
     - 4: can't finish;
     - 3: many get stuck;
     - 2: friction;
     - 1: cosmetic;
     - 0: not a problem;
   - what was done about it.
5. **Separate test artifacts from real problems.** YouTube is blocked in the E2E build, and the print emulation runs at phone width; neither counts.

## Fix and repeat

- **Fix**: every severity 3–4 problem, plus severity 2 ones that are small. Follow CLAUDE.md as for any change:
  - design-system tokens only;
  - text from `messages/`;
  - tests for what changed;
  - decisions in `docs/decisions.md`.
- **Repeat**: rebuild (`npm run build:e2e`), then run the next round with `USABILITY_ROUND=<n+1>`. Stop after 3 rounds, or sooner when no severity 3–4 is left.
- **Verify a broken step**: when a step fails, check whether the script or the site is wrong before calling it a finding (round 1 of 2026-11-09: a label the script had wrong).
  - The three devices share one stand-in Supabase, one after another: a step that changes an account (a folder, the waiting list) must clean up or use an account per device (round 1 of 2026-11-13).
  - Steps time out after 10 s (`actionTimeout`), so a broken step doesn't hold the run.
- **Other agents**: set `MOCK_SUPABASE_PORT` and `E2E_PORT` (for `build:e2e` too) when other checkouts run tests at the same time.

## Report

Update `docs/usability-ai-test.md`:

- **Results by round**: tasks completed, the number of 3–4 and 2 problems, phone above-fold characters, axe violations;
- **The findings table**;
- **Persona quotes**;
- **Readability metrics**;
- **A simulated SUS**: answer the 10 SUS items as each persona and convert to 0–100; say it's simulated;
- **Next steps**: always recommend a round with 3–5 real people.

Add or change tasks in `usability/tasks.spec.ts`, and keep the task list in `docs/personas.md` in step with it.
