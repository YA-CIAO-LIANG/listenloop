---
name: verify-prod
description: Check the ListenLoop production site after a deploy — main pages answer, security headers and CSP are in place, the YouTube player loads without CSP violations, the manifest and robots work, RLS is closed to the public key — and tell Joe what to check by hand on the admin pages (setup check, connection test, usage). Use after merging, or when Joe asks 「檢查正式站」「verify prod」.
---

# Verify production

Site: https://listenloop-three.vercel.app. Free checks only: never call a paid API (the connection test on `/admin/usage` is free, but it needs Joe's admin session, so Joe presses it). Report in 繁體中文.

## 1. Deployment

```sh
gh api repos/YA-CIAO-LIANG/listenloop/commits/$(git rev-parse origin/main)/status \
  --jq '.statuses[] | select(.context=="Vercel") | .state'
```

It must be `success` for the latest main commit.

## 2. Pages and headers

```sh
for p in / /explore /videos/sintel /videos/sintel/day/1 /terms /privacy /feedback /credits /manifest.webmanifest /robots.txt /sitemap.xml; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' https://listenloop-three.vercel.app$p)" "$p"
done
curl -sI https://listenloop-three.vercel.app/ | grep -iE 'content-security-policy|strict-transport|x-frame|permissions-policy'
```

Expect 200 everywhere; a CSP with `'nonce-…'` and `'strict-dynamic'`; HSTS; `X-Frame-Options: DENY`. Signed out, `/admin` and `/materials` must be 404.

## 3. In a real browser

With Playwright's Chromium (YouTube not blocked), open `/`, `/videos/sintel`, `/videos/sintel/day/1`, `/explore`: count `youtube-nocookie` frames (1 on video and practice pages), and collect console errors and any "Content Security Policy" / "Refused to" messages. There must be none.

## 4. Data access

```sh
npm run rls:check
```

Every line must be ✓.

## 5. Ask Joe to check by hand (signed in as admin)

- `/admin/usage`: 「設定診斷」all ✓; press 「測試連線（免費）」and both show 連線成功; today's calls look right.
- `/admin`: numbers load; `/admin/errors`: nothing new and unexpected.

## Report

A short list: what passed, what failed (with the exact status or message), and what Joe should look at.
