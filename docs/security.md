# 資安：威脅模型、OWASP 檢查與自動掃描（D158）

這份文件記錄 ListenLoop 保護什麼、可能被怎麼攻擊、目前的對策，以及每次檢查的結果。改到登入、權限、上傳、AI、金流或標頭時，要回來更新。出事時的處理步驟在 `docs/incident-runbook.md`。

## 1. 主要資產

| 資產          | 內容                                                      | 外洩或被竄改的後果                 |
| ------------- | --------------------------------------------------------- | ---------------------------------- |
| 帳號          | email、登入方式、方案、學生驗證時間                       | 個資外洩、冒用身分                 |
| 學習資料      | 進度、聽寫答案、跟讀紀錄、錯字複習                        | 隱私、使用者失去紀錄               |
| 自建教材      | 使用者的文字、私人教材、錄音（`uploads` bucket）          | 私人內容外洩、著作權問題           |
| 金鑰          | Supabase secret key、Azure、Gemini、Google、LINE 等 15 種 | 被盜用花錢、整個資料庫外洩         |
| AI 額度與預算 | Azure 學生額度 US$100、每月全站上限                       | 被灌爆花費、正常使用者無法建立教材 |
| 管理功能      | 後台、緊急開關、方案設定、下架                            | 網站被關閉、內容被竄改             |
| 網站可用性    | Vercel、Supabase 免費額度                                 | 服務中斷                           |
| 備份          | 每日加密備份（D157）                                      | 整個資料庫外洩（如果沒有加密）     |

## 2. 信任邊界與攻擊面

```
瀏覽器（不可信） ──HTTPS──▶ Vercel：Next.js（proxy、頁面、Server Actions、Route Handlers）
     │                              │ secret key（只在伺服器）
     │ publishable key + 使用者 JWT  ▼
     └──────────────▶ Supabase：PostgREST（RLS）、Auth、Storage
                                    ▲
GitHub Actions（排程、CI）──CRON_SECRET──▶ /api/cron/*
                    伺服器 ──API key──▶ Azure OpenAI、Azure Speech、Gemini、Google
```

| 攻擊面                        | 位置                                                                        | 誰能用                                      |
| ----------------------------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| 頁面與 Server Actions         | `app/**/page.tsx`、`app/**/actions.ts`、`auth/actions.ts`                   | 任何人；各 action 自己檢查身分（見 §4 A01） |
| Route Handlers                | `app/**/route.ts`（登入回呼、匯出、金流 webhook、邀請、健康檢查、cron）     | 任何人；各自驗證                            |
| Supabase REST API（直接呼叫） | 瀏覽器用 publishable key 加上使用者 JWT                                     | 任何人；**只靠 RLS 保護**                   |
| Supabase Storage              | `speech`（公開讀）、`uploads`（私人，簽名網址）                             | 寫入只有伺服器                              |
| 上傳                          | 文字檔、錄音（瀏覽器轉成 MP3 後用簽名網址上傳）                             | 登入且方案允許的人                          |
| AI 提示詞                     | 使用者的文字、主題、改寫指令會送到模型                                      | 登入且方案允許的人                          |
| 排程端點                      | `/api/cron/monitor`、`/api/cron/weekly`                                     | 只有持有 `CRON_SECRET` 的人                 |
| 第三方腳本                    | YouTube 播放器、Microsoft Clarity（同意後）、Cloudflare Turnstile（設定後） | CSP 只允許這幾個網域                        |
| CI 與 repo                    | 公開 repo、GitHub Actions、artifact                                         | 任何人可以讀；寫入需要 Joe 的帳號           |

## 3. STRIDE 威脅模型

| 類別                                     | 威脅                                             | 對策                                                                                                                                  | 程式位置                                                     |
| ---------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **S** 冒充（Spoofing）                   | 偷用別人的工作階段                               | Supabase Auth：JWT 由伺服器用 `getClaims()` 驗證；cookie 是 HttpOnly、Secure、SameSite=Lax；登出時撤銷 refresh token                  | `auth/session.ts`、`auth/proxy-session.ts`                   |
|                                          | 偽造管理員                                       | 角色存在資料庫（`profiles.role`）或 `ADMIN_EMAILS` 環境變數，前端無法改；高風險操作需要 30 分鐘內登入過（D159）                       | `auth/creator.ts` `getAdminUser`、`auth/recent-auth.ts`      |
|                                          | 偽造金流 webhook、cron 呼叫                      | HMAC 簽章加時間戳、防重送；cron 用 `CRON_SECRET` 並以常數時間比對                                                                     | `lib/payments/signature.ts`、`lib/ops/cron-auth.ts`          |
|                                          | 機器人大量註冊                                   | 每個 IP 的註冊速率限制、Beta 名額、Turnstile（D160）、濫用偵測（D162）                                                                | `auth/rate-limit.ts`、`auth/beta.ts`                         |
| **T** 竄改（Tampering）                  | 直接用 REST API 改別人的資料                     | 所有資料表開 RLS（測試強制檢查），寫入限本人；公開分享在資料庫用觸發器檢查開關（D155）                                                | `supabase/migrations/`、`tests/rls-coverage.test.ts`         |
|                                          | 改自己的方案、額度、角色                         | `profiles` 只能讀；方案與用量只有伺服器（secret key）能寫                                                                             | migrations：profiles、api_usage                              |
|                                          | 竄改上傳檔或大小                                 | 伺服器在使用前讀檔頭驗證真實格式與實際大小（D159）                                                                                    | `lib/upload-audio.ts`、`app/materials/upload-actions.ts`     |
|                                          | 竄改依賴套件或 CI 工具                           | `package-lock.json` 加上 `npm ci`；Dependabot；gitleaks 的 binary 用官方 checksum 驗證                                                | `.github/`                                                   |
| **R** 否認（Repudiation）                | 管理員否認做過某個操作                           | 所有管理操作寫入 `admin_audit`（保留 2 年），包括緊急開關、方案、下架、額度調整                                                       | `auth/audit.ts`                                              |
|                                          | 使用者否認公開了侵權內容                         | 公開錄音要勾選權利聲明，並記錄時間（`rights_confirmed_at`）；記錄 `practice_public` 事件                                              | `app/materials/organize-actions.ts`                          |
| **I** 資訊洩漏（Information disclosure） | 私人教材、錄音被看到                             | RLS、私人 bucket、簽名網址短效期（播放 1 小時、上傳 2 小時，D159）                                                                    | `auth/practice-material.ts`                                  |
|                                          | 金鑰出現在前端或 repo                            | 只有 `NEXT_PUBLIC_*`（都是公開值）會進 bundle，有測試檢查；gitleaks 掃描歷史與每個 PR；`.env*` 在 `.gitignore`                        | `tests/client-bundle-secrets.test.ts`、`.gitleaks.toml`      |
|                                          | 錯誤訊息、標頭洩漏技術細節                       | 使用者只看到錯誤代碼（digest）；不送 `X-Powered-By`；健康檢查只回 ok／fail                                                            | `app/error.tsx`、`next.config.ts`、`app/api/health/route.ts` |
|                                          | 備份被下載                                       | AES-256 加密，沒有密碼就不上傳（D157）                                                                                                | `scripts/backup-encrypt.sh`                                  |
|                                          | 通知把個資送到 Discord                           | 通知只有數字與金額，沒有 email 或帳號                                                                                                 | `lib/ops/alerts.ts`                                          |
| **D** 阻斷服務（Denial of service）      | 灌爆 AI 額度                                     | 每人每日費用上限、全站每月上限、每小時速率限制、排隊、緊急開關、異常通知（D77、D155、D156）                                           | `auth/creator.ts`、`lib/usage.ts`                            |
|                                          | 灌爆 Supabase 或 Vercel 免費額度                 | 公開資料快取、速率限制、容量監控與預測                                                                                                | `docs/capacity.md`                                           |
|                                          | 大檔上傳                                         | 依方案限制大小與長度、bucket 本身的大小上限、儲存空間額度（D161）                                                                     | `lib/upload-audio.ts`                                        |
| **E** 權限提升（Elevation of privilege） | 一般使用者呼叫管理員的 action                    | 每個管理 action 都先 `getAdminUser()`；後台 layout 對非管理員回 404                                                                   | `app/admin/**`                                               |
|                                          | 透過 AI 提示詞注入，讓模型做別的事或輸出惡意內容 | 使用者輸入以 JSON 放在獨立的 user 訊息、輸出強制 JSON schema 並逐欄驗證、輸出一律當純文字顯示、禁止 `dangerouslySetInnerHTML`（D159） | `lib/ai/`、`lib/ai/input-guard.ts`                           |
|                                          | 透過 XSS 偷取工作階段                            | React 自動跳脫、CSP nonce 加上 `strict-dynamic`、`frame-ancestors 'none'`                                                             | `lib/security/csp.ts`、`proxy.ts`                            |

## 4. OWASP Top 10（2021）逐項檢查（2026-11-13）

| 項目                         | 檢查結果                                                                                                                                                   | 這次的修正                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| A01 存取控制失效             | RLS 全開（50 張表，測試強制）；每個 action 都檢查身分；管理頁面與 action 都檢查管理員。**缺**：管理員的高風險操作沒有要求近期登入；錄音簽名網址 6 小時偏長 | D159：高風險操作需要 30 分鐘內登入過；簽名網址縮短；公開分享在資料庫也會擋（D155）                               |
| A02 加密機制失效             | 全站 HTTPS，HSTS 有 preload；密碼由 Supabase 用 bcrypt 保存；速率限制用的 IP 只存雜湊；金鑰只在環境變數                                                    | 備份加密（D157）                                                                                                 |
| A03 注入                     | 資料庫一律用 PostgREST 或參數化的 RPC，沒有拼接 SQL；React 跳脫輸出；唯一的 `dangerouslySetInnerHTML` 是靜態的主題腳本。提示詞注入見 STRIDE 的 E           | D159：ESLint 禁止 `dangerouslySetInnerHTML`（那一處加註理由）；AI 輸入清理；測試確認 AI 回傳的 HTML 以純文字顯示 |
| A04 不安全的設計             | 方案限制集中在 `lib/plans.ts`；花費有每日與每月上限；速率限制；排隊                                                                                        | D155 緊急開關、D161 儲存空間與個人額度、D162 濫用偵測                                                            |
| A05 安全設定錯誤             | CSP、HSTS、X-Frame-Options、nosniff、Referrer-Policy、Permissions-Policy、COOP 都有。**缺**：送出 `X-Powered-By: Next.js`                                  | 這次：`poweredByHeader: false`；ZAP baseline 進 CI                                                               |
| A06 易受攻擊與過時的元件     | `npm audit --omit=dev`：0 個漏洞                                                                                                                           | 這次：Dependabot（npm、Actions；D163 起每月）、CodeQL（D163 起改用 Semgrep）                                     |
| A07 識別與驗證失效           | Supabase Auth；密碼規則（長度、常見密碼、不能和 email 相同）；登入每個 IP 每小時 20 次                                                                     | D159：確認登出會撤銷 refresh token；D160：Turnstile                                                              |
| A08 軟體與資料完整性失效     | `npm ci` 依 lockfile 安裝；金流 webhook 有 HMAC 與防重送；Actions 用主版本號釘選                                                                           | 這次：gitleaks 的 binary 用 checksum 驗證；CodeQL 也掃 Actions 的 workflow                                       |
| A09 安全記錄與監控失效       | `error_logs`、`admin_audit`、`api_calls`、`events`                                                                                                         | D156：監控與通知、每週摘要                                                                                       |
| A10 伺服器端請求偽造（SSRF） | 伺服器只呼叫固定的供應者網址；YouTube 只接受影片 id，再呼叫固定的 API；Discord webhook 只接受 discord.com 的網址；使用者不能指定伺服器要去哪裡抓資料       | 不需要修正                                                                                                       |

## 5. 自動化掃描

| 工具                                    | 什麼時候跑                                               | 在哪裡看結果                                   |
| --------------------------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| gitleaks                                | 每個 PR（只掃這次的 commit）；每週的完整 CI 掃完整歷史   | CI 紀錄；有發現時 CI 失敗                      |
| Semgrep（D163，取代 CodeQL）            | 改到程式的 PR、每週日                                    | Actions → Semgrep 的紀錄；有發現時失敗         |
| Dependabot                              | 每月（D163）                                             | GitHub 的 PR、Security → Dependabot alerts     |
| OWASP ZAP baseline                      | 改到標頭、proxy、安全設定的 PR，以及每週一               | Actions → ZAP baseline → artifact `zap-report` |
| GitHub secret scanning、push protection | 公開 repo 才免費；改私人後停止（D163），由 gitleaks 補上 | GitHub → Security → Secret scanning            |

### 2026-11-13 的掃描結果

- **gitleaks，完整歷史**（418 個 commit、約 14 MB）：找到 10 筆，**全部是誤報**，沒有任何真正的金鑰曾被提交，**不需要輪替任何金鑰**。
  - 4 筆是 `package.json` 的 `NEXT_PUBLIC_SUPABASE_ANON_KEY=e2e-publishable-key`：E2E 用的假值。
  - 6 筆是 `lib/blender-films.ts` 裡片段的 id 欄位（名稱叫 key，值是 elephants-dream-1 這類片段名稱）。
  - 已加進 `.gitleaks.toml` 的允許清單，各附理由；套用後重掃，結果是 0 筆。
- **npm audit**（正式依賴）：0 個漏洞。
- **Semgrep**（D163，改私人前本機第一次執行，1.185.0、5 組開源規則、610 個檔案）：0 筆。
- **CodeQL**（PR #202 的第一次執行；D163 起停用）：1 個 Medium：第三方 action `zaproxy/action-baseline` 用標籤而不是 commit 釘選（標籤可以被改指到別的程式碼）。**修正**：改成釘選 commit SHA（D159）。程式碼本身 0 個警告。
- **gitleaks（CI）** 在 PR #202 第一次執行時就擋下一筆：這份文件引用了誤報的原文，被當成金鑰。改寫文字後通過，證實檢查有在運作。
- **OWASP ZAP baseline**（PR #202，掃描 runner 上的 production build）：找到 14 種項目，沒有 High。處理方式：

  | ZAP 規則                                           | 風險          | 處理                                                                                                            |
  | -------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------- |
  | 10055 CSP：style-src 允許 `unsafe-inline`          | Medium        | 接受：React 的 style 屬性與 next/font 需要它；script 只允許 nonce 加上 `strict-dynamic`，注入的樣式無法執行程式 |
  | 10099 原始碼洩漏（SQL）                            | Medium        | 誤報：英文介面文字「Select any sentence to play from there」被當成 SQL                                          |
  | 90004 缺少 Cross-Origin-Resource-Policy            | Low           | **修正**：加上 `Cross-Origin-Resource-Policy: same-origin`（D159）                                              |
  | 90004 缺少 Cross-Origin-Embedder-Policy            | Low           | 接受：`require-corp` 會擋掉 YouTube 播放器與 Supabase 的音檔                                                    |
  | 10094 Base64、10027 可疑註解、10031 使用者可控屬性 | Informational | 誤報：`?next=` 的網址編碼、sw.js 註解裡的 from、`?next=` 經過 `safeNextPath` 且 React 會跳脫                    |
  | 10109、10049、90005                                | Informational | 資訊性質；90005 是 ZAP 自己沒送的請求標頭                                                                       |
  - 已接受的項目寫在 `.zap/rules.tsv`，每項附理由。之後出現**新的**警告，ZAP 工作流程就會失敗（`fail_action`）。
  - 另外，正式站目前送出的 `X-Powered-By: Next.js` 已在 D158 移除。

## 6. 個人資料盤點與保留期限（D159）

| 資料                          | 存在哪裡                                                                        | 用途                 | 保留期限                                                             | 刪除帳號時                                                              |
| ----------------------------- | ------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Email、登入方式               | Supabase Auth（`auth.users`）                                                   | 登入、通知           | 帳號存在期間                                                         | 刪除                                                                    |
| 帳號資料                      | `profiles`（編號、方案、角色、學生驗證時間、最後上線時間）                      | 方案與權限           | 帳號存在期間                                                         | 刪除（cascade）                                                         |
| 學習紀錄                      | `progress`、`user_documents`（活動、錯字複習、練習時間）、`vocab_quiz_attempts` | 7 天循環、進度、統計 | 帳號存在期間                                                         | 刪除                                                                    |
| 自建教材與錄音                | `practices`、`practice_sentences`、`collections`、Storage `uploads/<帳號>/`     | 使用者的教材         | 帳號存在期間                                                         | 刪除資料列與錄音檔；只屬於這個帳號的音檔也刪除                          |
| 檢舉、回饋、問題句子          | `practice_reports`、`sentence_reports`、`feedback`                              | 審查與改善           | 帳號存在期間                                                         | 刪除                                                                    |
| 班級                          | `classes`、`class_members`、`assignments`、`announcements`                      | 班級功能             | 帳號存在期間                                                         | 刪除                                                                    |
| 練習提醒                      | `reminders`（推播 endpoint）                                                    | 推播提醒             | 關閉提醒或帳號存在期間                                               | 刪除                                                                    |
| 付款                          | `payments`、`subscriptions`、`payment_events`                                   | 金流、退款           | 帳號存在期間（目前只有測試資料）                                     | 刪除。**正式收費前要改成保留 5 年並解除關聯**（商業會計法），見 roadmap |
| 操作紀錄                      | `events`                                                                        | 學習分析、後台統計   | **180 天**                                                           | 刪除                                                                    |
| 付費意願點擊                  | `intent_events`                                                                 | 定價決策             | **365 天**（D159 新增）                                              | 解除關聯                                                                |
| Beta 等候名單（沒有帳號的人） | `beta_waitlist`（email、用途）                                                  | 邀請                 | **365 天**（D159 新增）                                              | 不適用；可以透過意見回饋要求刪除                                        |
| API 呼叫紀錄                  | `api_calls`                                                                     | 費用與額度           | 不刪（Azure 額度的累計依據）                                         | 解除關聯（set null），不再連到人                                        |
| 管理稽核                      | `admin_audit`                                                                   | 追蹤管理操作         | **2 年**                                                             | 對象 id 保留（沒有 email）                                              |
| 錯誤紀錄                      | `error_logs`（路徑、訊息，沒有帳號）                                            | 除錯                 | **90 天**                                                            | 不適用                                                                  |
| 速率限制                      | `rate_limits`（帳號 id，或 IP 的雜湊）                                          | 防濫用               | **1 天**                                                             | 隨時間刪除                                                              |
| 監控                          | `ops_alerts`、`health_checks`（沒有個資）                                       | 監控                 | 90 天、30 天                                                         | 不適用                                                                  |
| 第三方                        | Microsoft Clarity（同意後才載入）、Azure OpenAI 與 Speech（處理教材文字）       | 使用分析、AI 處理    | 依各服務：Azure 最多 30 天（偵測濫用，不用來訓練）；Clarity 依其設定 | 不適用                                                                  |

- **自動清除**：`prune_logs()` 每天由監控排程執行（D156），規則在最新的 `prune_logs` migration。
- **刪除帳號**（`auth/actions.ts` 的 `deleteAccount`）：刪除 Auth 帳號後，所有指向它的資料表都會依 `on delete cascade` 一起刪除，或用 `set null` 解除關聯。接著刪除只屬於這個帳號的音檔，以及 `uploads/<帳號>/` 整個資料夾。`tests/account-data-coverage.test.ts` 會檢查每一個指向帳號的欄位都有刪除規則。
- **匯出**：使用者可以在帳號頁下載自己的資料（`/account/export`）。

## 7. 工作階段（D159）

- 登入由 Supabase Auth 處理：access token（JWT）預設 1 小時有效，refresh token 每次使用就換新（rotation），舊的被重複使用時整串失效。
- 伺服器用 `getClaims()` 驗證 JWT 的簽章。登出（`signOut()`，預設範圍 global）會撤銷這個帳號**所有**的 refresh token。已經發出的 access token 在到期前（最多 1 小時）仍然有效，這是 JWT 的特性。
- 管理員停用帳號時，會同時在 Supabase Auth 封鎖（ban），無法再換新 token（D50）。
- 管理員的高風險操作要在 30 分鐘內登入過，依 JWT 裡 `amr` 的登入時間判斷；換新 token 不會更新這個時間（D159）。
- 免費方案無法設定「工作階段最長時間」與「閒置逾時」（Supabase Pro 才有）。

## 8. 回報資安問題

見 repo 根目錄的 `SECURITY.md`：用 GitHub 的「Report a vulnerability」（私人回報，要在 repo 設定開啟，見 roadmap），或網站的「意見回饋」頁；不要開公開的 issue。3 個工作天內回覆。
