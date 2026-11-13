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
| A06 易受攻擊與過時的元件     | `npm audit --omit=dev`：0 個漏洞                                                                                                                           | 這次：Dependabot（npm、Actions 每週）、CodeQL                                                                    |
| A07 識別與驗證失效           | Supabase Auth；密碼規則（長度、常見密碼、不能和 email 相同）；登入每個 IP 每小時 20 次                                                                     | D159：確認登出會撤銷 refresh token；D160：Turnstile                                                              |
| A08 軟體與資料完整性失效     | `npm ci` 依 lockfile 安裝；金流 webhook 有 HMAC 與防重送；Actions 用主版本號釘選                                                                           | 這次：gitleaks 的 binary 用 checksum 驗證；CodeQL 也掃 Actions 的 workflow                                       |
| A09 安全記錄與監控失效       | `error_logs`、`admin_audit`、`api_calls`、`events`                                                                                                         | D156：監控與通知、每週摘要                                                                                       |
| A10 伺服器端請求偽造（SSRF） | 伺服器只呼叫固定的供應者網址；YouTube 只接受影片 id，再呼叫固定的 API；Discord webhook 只接受 discord.com 的網址；使用者不能指定伺服器要去哪裡抓資料       | 不需要修正                                                                                                       |

## 5. 自動化掃描

| 工具                                    | 什麼時候跑                                            | 在哪裡看結果                                   |
| --------------------------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| gitleaks                                | 每個 PR（CI 的 `check`，只掃這次的 commit）           | CI 紀錄；有發現時 CI 失敗                      |
| CodeQL                                  | 每個 PR、合併到 main、每週日                          | GitHub → Security → Code scanning              |
| Dependabot                              | 每週一                                                | GitHub 的 PR、Security → Dependabot alerts     |
| OWASP ZAP baseline                      | 改到標頭、proxy、安全設定的 PR，以及每週一            | Actions → ZAP baseline → artifact `zap-report` |
| GitHub secret scanning、push protection | 每次 push（公開 repo 免費，要在設定開啟，見 roadmap） | GitHub → Security → Secret scanning            |

### 2026-11-13 的掃描結果

- **gitleaks，完整歷史**（418 個 commit、約 14 MB）：找到 10 筆，**全部是誤報**，沒有任何真正的金鑰曾被提交，**不需要輪替任何金鑰**。
  - 4 筆是 `package.json` 的 `NEXT_PUBLIC_SUPABASE_ANON_KEY=e2e-publishable-key`：E2E 用的假值。
  - 6 筆是 `lib/blender-films.ts` 裡片段的 id 欄位（名稱叫 key，值是 elephants-dream-1 這類片段名稱）。
  - 已加進 `.gitleaks.toml` 的允許清單，各附理由；套用後重掃，結果是 0 筆。
- **npm audit**（正式依賴）：0 個漏洞。
- **ZAP baseline**、**CodeQL**：結果記在本節的下一段（由 CI 執行）。

## 6. 個人資料盤點與保留期限

（D159 補上。）

## 7. 回報資安問題

見 repo 根目錄的 `SECURITY.md`：用 GitHub 的「Report a vulnerability」（私人回報，要在 repo 設定開啟，見 roadmap），或網站的「意見回饋」頁；不要開公開的 issue。3 個工作天內回覆。
