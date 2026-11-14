# 容量與穩定性（D133，2026-11-11）

這份文件回答四個問題：目前的架構在免費方案下大約能支援多少人、每個服務的上限在哪裡、滿了會怎樣、要支援 5,000 位同時使用者要升級什麼、要花多少錢。最後依這些數字建議三個開放階段的註冊上限。

數字都是估算，依據是 2026-11-11 查的各服務官方價格與限制頁，以及本機的壓力測試。正式站的實際用量看後台「總覽 → 容量與免費額度」（超過 80% 會出現紅色警示）和 Vercel 後台的 Usage。

---

## 1. 目前的架構與流量走向

| 流量                | 經過哪裡                                          | 計入哪個額度                             |
| ------------------- | ------------------------------------------------- | ---------------------------------------- |
| 網頁、Server Action | Vercel 函式（Next.js）                            | Vercel：函式次數、CPU 時間、流量         |
| 讀寫練習進度        | 瀏覽器直接連 Supabase（REST API）                 | Supabase：egress（出口流量）、資料庫大小 |
| 教材音檔            | Supabase Storage 的公開網址，經過 Supabase 的 CDN | Supabase：cached egress、檔案儲存        |
| 上傳的錄音          | 瀏覽器直接上傳到 Supabase（簽名網址）             | Supabase：檔案儲存、egress               |
| YouTube 影片        | YouTube 播放器                                    | 不計入我們的任何額度                     |
| 建立教材的 AI       | 伺服器呼叫 Azure OpenAI、Azure Speech             | Azure 學生額度（US$100）、F0 免費額度    |

### 這次做的改善

1. **音檔長效快取**：查過正式站。所有音檔回應都是 `cache-control: public, max-age=31536000`，第二次請求 Supabase CDN 回 `cf-cache-status: HIT`。音檔的檔名就是內容的雜湊，內容不會變，所以可以快取一年。上傳的錄音也用同樣的設定。
   - 例外：錄音放在私人儲存空間，網址是每次載入都不同的簽名網址，所以瀏覽器只在同一次練習中重複使用。
2. **公開資料快取**：首頁教材庫、學習中心、SEO 文章、未登入時的 `/explore` 和教材頁，改用不帶 cookie 的公開金鑰讀取，結果快取 5 分鐘。管理員發布、下架或排序時會立刻更新（`updateTag("library")`）。
   - 實測（`loadtest/db-reads.sh`）：首頁原本每次瀏覽要查 3 次資料庫，現在第一次查 3 次，之後 20 次瀏覽都是 0 次。`/explore` 從每次 3 次降到 0 次。未登入的官方教材頁從每次 2 次降到 0 次。
3. **排隊處理**：Azure Speech F0 每分鐘大約只能產生 20 句語音，語音轉文字一次只能處理一個請求。現在建立教材的語音和上傳錄音的轉文字都會排隊，一份接一份處理（Pro 方案優先），畫面顯示「前面還有 N 份」。不會再出現多人同時建立、全部因為「忙碌」而失敗的情況。
4. **索引**：用 `supabase inspect db` 檢查正式資料庫。所有大表都已經有對應查詢的索引；新增兩個：`speech_audio(path)`、`practice_sentences(audio_path)`。原本刪除帳號和計算教材長度時，會掃過整張表。
5. **連線池**：App 不直接連 Postgres，全部透過 Supabase 的 HTTP API（PostgREST、Storage、Auth）。資料庫連線由 Supabase 的連線池管理，Vercel 函式再多也不會耗盡資料庫連線。
   - 之後如果加入直接連線的程式（例如 Prisma 或批次腳本），要用 Supabase 的 Supavisor **transaction 模式**連線字串（port 6543），不要用 5432 的直連。

---

## 2. 壓力測試結果

用 k6 在本機 production 模式測試：E2E 用的 build、假的 Supabase、假的 AI 供應者，不對正式資料庫寫入。每位虛擬使用者依序開首頁、影片頁、第 1 天練習頁、學習中心、公開教材，每頁之間停 1～3 秒，三分之一的人已登入。先用 15 秒爬升到目標人數，再持續 45 秒。

指令是 `npm run build:e2e`，然後 `npm run loadtest`（預設 100、500、1000 人）。

| 同時使用者 | 改善前：每秒請求 | 改善前：p95 | 改善後：每秒請求 | 改善後：p95 | 錯誤率 |
| ---------: | ---------------: | ----------: | ---------------: | ----------: | -----: |
|        100 |               42 |       29 ms |               42 |       27 ms |     0% |
|        500 |              210 |       57 ms |              210 |       37 ms |     0% |
|      1,000 |              331 |    1,418 ms |              347 |    1,364 ms |     0% |

**解讀**

- 本機只有一個 Node 程序，大約每秒 350 個請求就到 CPU 上限，所以 1,000 人時變慢，但沒有錯誤。瓶頸是伺服器端產生頁面的 CPU 時間，不是資料庫。
- 正式站在 Vercel 上，函式會依流量自動增加執行個體（fluid compute），不會只有一個程序。所以實際的限制不是「同時多少人」，而是**每個月的免費額度**（下一節）。
- 本機的假資料庫沒有網路延遲，所以快取在回應時間上的效果不明顯。正式站每次查詢 Supabase（美國東部）大約要 50～150 ms，減少查詢次數對正式站的效果比表中明顯。

---

## 3. 各服務的上限，滿了會怎樣

| 服務                  | 免費方案的上限（每月）                                                                                                    | 滿了會怎樣                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Vercel Hobby**      | 函式呼叫 100 萬次；Active CPU 4 小時；流量 100 GB；Origin 傳輸 10 GB；函式儲存空間 10 GB（所有還存在的部署合計，第 8 節） | 超過時 Vercel 會暫停專案，網站打不開，直到下個月或升級。**Hobby 只能非商業使用**，開始收費前一定要升級 Pro |
| **Supabase Free**     | 資料庫 500 MB；檔案 1 GB；egress 5 GB 加 cached egress 5 GB；MAU 5 萬；單檔 50 MB                                         | 超過會收到通知，持續超過可能限制服務。**一週沒有活動會暫停專案**（目前每天都有使用，不會發生）             |
| **Azure Speech F0**   | 語音合成 50 萬字元；語音轉文字 5 小時；每分鐘約 20 個請求                                                                 | 超過後 Azure 回 403，不收費。網站會顯示「本月額度用完」。全站語音轉文字上限設 4.5 小時                     |
| **Azure OpenAI**      | 學生額度 US$100（到 2027-11-04）                                                                                          | 網站自己的每月上限（目前 US$8）先擋下，一般使用者暫停建立教材                                              |
| **Supabase 內建寄信** | 每小時只能寄少量的確認信、重設密碼信                                                                                      | Email 註冊的人會收不到確認信。**Beta 期間建議引導使用 Google 登入**；人多時要設定自訂 SMTP（Joe 待辦清單） |

### 用量模型與大約能支援的人數

假設一位每天練習的使用者（DAU）一天做一次練習：開約 10 頁，加上約 30 次 Server Action（進度、操作紀錄、預先載入），聽約 10 句音檔（約 250 KB，重聽會用瀏覽器快取）。

| 限制                                | 每位 DAU 每月用掉 | 免費額度可支援的 DAU |
| ----------------------------------- | ----------------- | -------------------: |
| Vercel 函式呼叫（100 萬次）         | 約 1,200 次       |               約 800 |
| Vercel Active CPU（4 小時）         | 約 1,200 × 10 ms  |             約 1,200 |
| Vercel 流量（100 GB）               | 約 60 MB          |             約 1,600 |
| Supabase egress（5 GB + 5 GB 快取） | 約 15 MB          |               約 600 |
| Supabase 資料庫（500 MB）           | 約 0.1 MB         |   數千人（不是瓶頸） |

**結論**：免費方案下，大約可以支援 **300～600 位每天練習的使用者**，同一時間在線約 **50～100 人**。最先碰到的是 Supabase 的 egress 和 Vercel 的函式呼叫次數。

建立教材是另一個限制：Azure F0 每月 50 萬字元，大約是 500 份 1,000 字的教材；語音轉文字 5 小時。超過時會排隊或顯示額度用完，不會產生費用。

---

## 4. 要支援 5,000 位同時使用者

5,000 位同時在線，大約對應 25,000～50,000 位 DAU。以下是需要升級的方案和每月估算（美元，2026-11 價格）：

| 項目                                | 方案                                                                                           |           每月估算 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- | -----------------: |
| Vercel                              | Pro（US$20/人/月）＋超出用量：函式約 6,000 萬次 × US$0.60/百萬、Active CPU、Flat Rate CDN 流量 |        US$100～250 |
| Supabase                            | Pro（US$25）＋ Small compute（US$15）＋超出 250 GB 的 egress（約 500 GB × US$0.09）            |         US$80～130 |
| 音檔改放 Cloudflare R2（見第 5 節） | 儲存約 5 GB × US$0.015、讀取約 3,000 萬次 × US$0.36/百萬，**出口流量免費**                     |          US$10～15 |
| Azure Speech（S0）                  | 語音合成 US$16/百萬字元、語音轉文字 US$1/小時，依建立量而定                                    |         US$20～100 |
| Azure OpenAI（付費）                | gpt-5-mini，依建立量而定                                                                       |         US$20～100 |
| 自訂網域＋寄信（SMTP）              | 網域約 US$15/年；寄信服務（例如 Resend）免費額度通常夠用                                       |           US$0～20 |
| **合計**                            |                                                                                                | **約 US$250～600** |

需要的程式調整（目前不需要做）：

- 音檔改用 R2 或其他零出口流量的儲存服務（第 5 節）。
- Vercel Pro 開啟 Spend Management，設定每月預算上限與通知。
- 把排隊的 slots 調高（`lib/queue.ts`），因為付費的 Azure S0 速率比 F0 高很多。
- 練習進度同步改成批次寫入，降低 Supabase 請求數。

---

## 5. 評估：音檔移到 Cloudflare R2（先不實作）

**為什麼**：音檔是最大的流量來源。Supabase 的 egress 免費只有 5 GB（Pro 250 GB），超過後每 GB US$0.09。Cloudflare R2 的出口流量免費，儲存 US$0.015/GB/月，讀取 US$0.36/百萬次，每月前 10 GB 儲存、1,000 萬次讀取免費。

**成本比較**（每月 500 GB 音檔流量）：

- Supabase：(500 − 250) GB × US$0.09，約 US$22.5（Pro 方案內）。
- R2：0 元流量費，加上讀取次數（約 2,000 萬次，前 1,000 萬次免費），約 US$3.6。

人少時差異不大；流量到幾百 GB 以上才有明顯差別。

**步驟**（需要 Joe 開 Cloudflare 帳號，R2 要綁信用卡，但有免費額度）：

1. Cloudflare → R2 → 建立 bucket（例如 `listenloop-audio`），開啟公開存取，或綁自訂網域 `audio.<你的網域>`（建議，可以用 Cloudflare 快取）。
2. 建立 R2 API Token（只能寫這個 bucket），放在 Vercel 環境變數：`R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET`、`NEXT_PUBLIC_AUDIO_BASE_URL`。
3. 程式：`auth/audio-store.ts` 改成用 S3 相容 API 上傳到 R2（`@aws-sdk/client-s3`），`speechAudioUrl` 改成 `NEXT_PUBLIC_AUDIO_BASE_URL/<path>`。檔名不變，不用改資料庫。
4. 用腳本把現有的 `speech` bucket 檔案複製到 R2（目前約 1,000 個檔案、27 MB），驗證後再切換網址。
5. CSP 的 `media-src` 加上新的音檔網域。
6. 上傳的錄音（私人）可以先留在 Supabase；要搬的話，R2 也支援簽名網址。

---

## 6. 建議的三個開放階段

| 階段                  | 註冊上限     | 條件與做法                                                                                                                                                                                                                   |
| --------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **封閉 Beta**（現在） | **50～100**  | 全部在免費方案內，量很小。用邀請碼找真正會用的人，收集意見回饋。Email 註冊受 Supabase 寄信限制，主要用 Google 登入。                                                                                                         |
| **小規模公開**        | **300～500** | 前提：設定自訂 SMTP（Email 註冊才不會收不到信）、Google 登入正式發布、每週看一次後台的容量警示。300～500 個帳號大約是 150～250 位 DAU，還在免費額度內，有一半的餘裕。**開始收費前先升級 Vercel Pro**（Hobby 不能商業使用）。 |
| **全面公開**          | 不設上限     | 前提：Vercel Pro、Supabase Pro、音檔改放 R2、自訂網域、Vercel 預算上限與通知、Azure 改用付費方案（或維持建立教材的排隊與上限）。依第 4 節，每月約 US$250～600，用量越大越接近上限。                                          |

升級到下一階段的時機：後台「容量與免費額度」任一項持續超過 80%，或 Vercel Usage 頁接近額度。

---

## 7. 預測：額度何時用完（D156，2026-11-13）

後台「API 用量 → 預測與每週摘要」會依最新資料自動計算；以下是 2026-11-13 用正式資料庫數字算的結果。

| 項目                            | 目前                                 | 最近 30 天的速度                                             | 預計用完或滿載                                                                                                                           |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Azure 學生額度（US$100）        | 已用 US$2.10，剩 US$97.90            | 每天約 US$0.07（大多是 11/8、11/9 製作官方教材）             | 照這個速度約要 1,400 天，**到期日 2027-11-04 前用不完**。要在到期前用完，平均每天要花 US$0.27（每月約 US$8，剛好是全站每月上限）         |
| Supabase 資料庫（500 MB）       | 27 MB（5%）                          | 還沒有每日紀錄（監控上線後每天記錄一次）                     | 用量模型：每位活躍使用者每月約 0.1 MB，要數千人才會滿                                                                                    |
| Supabase 檔案儲存（1 GB）       | 44 MB（4%）                          | 同上                                                         | 每份 1 分鐘教材的音檔約 0.5～1 MB，大約 1,000 份教材會滿；**最可能最先碰到的 Supabase 上限**。快滿時看第 5 節（Cloudflare R2）或升級 Pro |
| Azure Speech F0（每月 50 萬字） | 本月 11.2 萬字（22%）                | 每月 1 日重設                                                | 每月大約可以產生 500 份 1,000 字的教材；用完時這個月不能產生新音檔，不收費                                                               |
| Vercel Hobby                    | 沒有免費 API，請看 Vercel 後台 Usage | 依第 3 節的模型，每位每天練習的使用者每月約 1,200 次函式呼叫 | 約 800 位每天練習的使用者時碰到函式呼叫的上限（100 萬次）                                                                                |

### 怎麼看、怎麼應對

- **每週一**會收到（或在後台看到）每週摘要，包括上週花費、新帳號與新教材，以及上面三項預測。
- 任何一項達到 80% 會立即通知（D156）。應對步驟見 `docs/incident-runbook.md` 的「Supabase 流量或儲存超過上限」「Azure 額度用完」。
- Azure 額度的預測是用**全部** AI 與語音花費估算，偏保守；Gemini 或 Google 的花費不會扣學生額度。

---

## 8. Vercel Functions Storage（D175，2026-11-14）

### 發生了什麼

Vercel Hobby 除了每月的呼叫次數與 CPU，還有一個**累計**的上限：**Functions Storage 10 GB**。每一個還存在的部署（Production 和 Preview 都算）都保留自己的伺服器函式，全部加起來不能超過 10 GB。滿了之後，Vercel 不接受新的部署。

2026-11-14 Vercel 後台顯示 **10.57 GB / 10 GB**。用 Vercel API（`GET /v11/deployments/{id}/builds`，取 `type == "lambda"` 的輸出、依 `digest` 去重、加總 `size`）量到：

| 項目           | 數字                                                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 每個部署的函式 | 5 個，共約 **45 MB**：主要函式 21.08 MB（127 個路由）、11.36 MB（account/export、admin/waitlist/export…）、11.28 MB（admin/official、admin/usage…）、0.92 MB（api/cron/\*）、0.40 MB（middleware） |
| 部署數         | 62 個，約 2.77 GB（依 API 計算）                                                                                                                                                                   |
| 刪除後         | 刪掉 58 個，留下目前的 Production 與 3 個較新的 Production：**4 個部署、約 180 MB**                                                                                                                |

API 算出來的 2.77 GB 比後台的 10.57 GB 小很多：後台的計算方式 Vercel 沒有公開（可能包含已刪除部署、或依時間累計），所以兩邊數字不一定一樣。刪除後 24～48 小時內後台沒有下降時，用下面的訊息聯絡 Vercel。

### 這次的改善

1. **縮小每個部署的函式**（`next.config.ts` 的 `outputFileTracingExcludes`）：
   - `sharp` 與 `@img/sharp-libvips-*` 只給 Next.js 自架時的圖片最佳化用。我們的程式沒有使用；Vercel 上的圖片最佳化是平台服務，`next/og` 用自己的 resvg。原本每個頁面函式都帶著它（Linux 上約 16～18 MB）。
   - 測試、文件、腳本、行銷素材、`package-lock.json` 等不會在伺服器執行的資料夾，一律排除。
   - `/admin/docs` 和 `/blog/[slug]` 原本用 `join(process.cwd(), 變數)` 讀檔，build 工具無法判斷會讀哪些檔案，於是**把整個專案**（tests、docs、截圖等約 20 MB）放進這兩個函式。改成寫出固定的資料夾（`"docs", "system"`、`"content", "blog"`），只會帶入需要的 Markdown。
2. **本機量測**：`npm run size:functions`（先 `npm run build`）。讀 `.next/server/**/*.nft.json`，列出每組路由帶入的檔案大小與最大的套件。本機是 macOS，數字含 darwin 的原生套件，只適合比較同一台電腦的前後差異。

| 本機量測（macOS）                      |   改善前 |                        改善後 |
| -------------------------------------- | -------: | ----------------------------: |
| 所有函式合計（每個檔案只算一次）       | 57.07 MB |                      25.74 MB |
| Next.js 伺服器執行環境（每個函式共用） | 31.19 MB |                      12.80 MB |
| `app/admin`（23 個路由）               | 39.92 MB |                       8.58 MB |
| `app/blog`（2 個路由）                 | 37.95 MB |                       6.39 MB |
| 一般頁面（例如 `app/videos`）          | 26.02 MB |                       7.62 MB |
| `sharp-libvips`                        | 17.40 MB |                          0 MB |
| 專案資料夾 `docs`、`tests`、`scripts`  |  8.89 MB | 0.24 MB（只剩 `docs/system`） |

合併後，到後台「總覽 → 容量與免費額度」看新部署的大小（預估每個部署從約 45 MB 降到約 10～15 MB）。

3. **後台監控**：「容量與免費額度」多一格「Vercel 函式儲存空間」，顯示已用、上限 10 GB、百分比與部署數，每小時向 Vercel API 更新一次（`auth/vercel-storage.ts`；計算在 `lib/ops/vercel-storage.ts`）。
   - 每天的監控（D163 的每日工作）也會檢查：**70% 以上**發警告、**90% 以上**發嚴重通知到 Discord（`lib/ops/alerts.ts`，同一個通知 6 小時內不重發）。上限與比例在 `lib/ops/thresholds.ts`。
   - 沒有設定 `VERCEL_API_TOKEN` 時顯示「未設定」，不影響其他功能。
4. **清除舊部署**：`npm run vercel:prune`。預設只列出會刪除哪些部署（dry run）；加 `-- --yes` 才真的刪除。
   - 保留：目前 Production 指向的部署，加上 3 個較新的 Production（`-- --keep 5` 可以改數字），所以**仍然可以 Instant Rollback**（見 `docs/deploy-rollback.md`）。
   - 刪除：所有 Preview、更舊的 Production。還在 build 的部署不會刪。
   - 金鑰：`VERCEL_API_TOKEN`，沒有時用 Vercel CLI 的登入（`vercel login`）；專案用 `VERCEL_PROJECT_ID`、`VERCEL_TEAM_ID`，沒有時讀 `.vercel/project.json`（`vercel link`）。
   - 刪除無法復原。`vercel.json` 已經限制只有 `main` 會自動部署，Preview 不會再一直累積。

### 設定後台監控（Joe）

1. 到 Vercel → 右上角頭像 → **Account Settings → Tokens** → **Create Token**。
   - Scope 選擁有 listenloop 專案的團隊（不要選 Full Account）；Expiration 選 1 年，到期前會收到 Email。
   - Vercel 的 token 沒有「唯讀」選項；這個 token 只放在 Vercel 的環境變數，網站只用它讀取部署清單。
2. 到 listenloop 專案 → **Settings → Environment Variables**，只加在 **Production**：
   - `VERCEL_API_TOKEN`：上一步的 token（勾選 Sensitive）。
   - `VERCEL_TEAM_ID`：`.vercel/project.json` 的 `orgId`（`team_` 開頭）。
   - `VERCEL_PROJECT_ID`：`.vercel/project.json` 的 `projectId`（`prj_` 開頭），或專案 **Settings → General** 的 Project ID。
3. Redeploy（或等下一次合併），打開後台總覽，「Vercel 函式儲存空間」應該顯示約 180 MB、4 個部署。

### 後台數字沒有下降時，寄給 Vercel 的訊息

刪除後 24～48 小時，Vercel 後台的 Functions Storage 還是約 10.57 GB 時，到 <https://vercel.com/help> 開支援單，貼上：

```text
Subject: Functions Storage usage not decreasing after deleting deployments (Hobby)

Hi Vercel team,

My Hobby project "listenloop" showed Functions Storage at 10.57 GB of the
10 GB limit. On 2026-11-14 I deleted 58 of its 62 deployments (all previews
and older production deployments), keeping the current production
deployment and three previous production deployments.

By the REST API (GET /v11/deployments/{id}/builds, summing the unique
"lambda" outputs by digest), the 4 remaining deployments use about 45 MB
each, roughly 180 MB in total. Even the 62 deployments before the deletion
added up to only about 2.77 GB by the same method. The usage dashboard
still shows about 10.57 GB more than 24 hours later.

Could you help me with the following?
1. Is Functions Storage recalculated on a schedule, and how long after
   deleting deployments should the dashboard reflect it?
2. Do deleted deployments (or anything else, such as build cache or
   deployments from other projects) still count towards Functions Storage?
3. If the usage is stale, could you recalculate or reset it for this
   project?

I have also reduced the size of each deployment's functions since then.

Thank you!
```
