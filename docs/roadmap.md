# 開發路線圖

剩下的工作依 a → f 的順序進行，一項做完才做下一項（2026-10-30 Joe 決定）。工作規則見 CLAUDE.md「給 Claude 的工作規則」，規格沒寫到的細節記在 `docs/decisions.md`。

**接續進度**：開新對話時，先讀 CLAUDE.md 和這份文件，從「進度」表第一個不是「完成」的項目接著做。每合併一個 PR，就更新這份表。

## 進度

| 項目 | 內容                     | 狀態                               |
| ---- | ------------------------ | ---------------------------------- |
| a    | 小修正                   | 完成（PR #35）                     |
| b    | M4 帳號                  | 下一項（需要 Joe 先完成清單 1～4） |
| c    | 同時練習多部影片完整支援 | 待做                               |
| d    | 建立練習                 | 待做（需要 Joe 完成清單 5）        |
| e    | 公開分享                 | 待做                               |
| f    | 方案限制的權限設定       | 待做                               |
| —    | 內容工作                 | 暫停，功能都完成後一次處理         |

## a. 小修正（PR #35）

- 評分時，數字和英文數字視為相同，% 和 percent 也視為相同（90 = ninety，90% = 90 percent = ninety percent）。
- 合併字幕時，停頓超過 2 秒就拆成兩句（`MAX_MERGE_GAP`，`npm run video:new` 會報錯）。
- Tears of Steel 以完整對白版作為唯一的時間來源：Part 1～3 用 `excerptOf` 對應到完整版，用 `npm run video:sync` 同步時間點，build 和測試都會檢查是否一致。
- 同一個 PR 裡也有 Tears of Steel 的 4 支草稿（`draft: true`，不公開）。時間點校正和審稿屬於內容工作，等功能完成後再處理。

## b. M4 帳號

- **不登入也能用**：資料照舊存在 localStorage；登入後，進度存到雲端。
- **PR 拆法**：
  - **b1 `feat/supabase-setup`**：
    - 加入 Supabase 官方 SDK（`@supabase/supabase-js`、`@supabase/ssr`）；
    - 加入環境變數，並更新 `.env.example`；
    - 資料表 migration（`supabase/migrations/`），每張表都開啟 RLS，只能讀寫自己的資料；
    - 沒有設定環境變數時，帳號功能整個隱藏，網站照舊運作。
  - **b2 `feat/google-login`**：
    - 頁首加上「登入」和帳號選單；
    - 新增 `/auth/callback`，並用 Next.js proxy 更新 session；
    - 登入失敗、取消登入時顯示友善提示。
  - **b3 `feat/cloud-progress`**：
    - 用 Supabase 實作 `ProgressStore`，練習活動紀錄也一起存；
    - 第一次登入時，把 localStorage 的進度搬到雲端，每支影片保留進度較多的一份（規則見 decisions.md）；
    - 搬移成功才標記完成，失敗時保留本機資料並可以重試。
  - **b4 `feat/account-deletion`**：
    - 新增設定頁「刪除帳號」：要再確認一次，伺服器端用 service role 刪除帳號和所有資料；
    - 刪除後登出，並清除本機資料；
    - 新增隱私權政策頁 `/privacy`（中英文），Google 登入需要這一頁。
- **完成時的測試重點**：
  - 用 Google 登入；
  - 換一台裝置或換一個瀏覽器，進度仍然在；
  - 登出後回到本機模式；
  - 刪除帳號後無法再取得資料。

## c. 同時練習多部影片的完整支援

目前每支影片已經有獨立的 7 天循環和起始日，首頁也會列出多支影片的今日任務。這一項要補齊的是：

- **c1**：新增「我的練習」頁，依進行中、已通過、等待重新開始分組。可以移除一支練習的進度，移除前要再確認一次。
- **c2**：題庫卡片和影片頁標示「練習中・第 N 天」；首頁的今日任務依照「可以做」「今天已完成」「還沒開放」排序。
- **c3**：用 Playwright 寫 E2E 測試：同時練習兩支影片，分別推進各自的天數，確認互不干擾。
- 同時練習數的上限之後在 f 處理，目前不限制。

## d. 建立練習

- **只開放給管理員**：付費上線前，只有管理員帳號可以使用，管理員名單放在環境變數 `ADMIN_EMAILS`。另外設每日用量上限，聲音和翻譯分開計算字數。
- **PR 拆法**：
  - **d1**：
    - 資料表：練習、句子、Collection、筆記本、用量紀錄，都開啟 RLS；
    - 管理員檢查和每日用量上限；
    - 翻譯和聲音 API 用「供應者介面」包起來，測試時用假的供應者，不會真的呼叫 API。
  - **d2**：
    - 上傳 `.txt` 文字檔，可以是中文或英文；
    - 自動斷句，中文先翻成英文；
    - 斷句和翻譯結果可以預覽、修改後再建立。
  - **d3**：
    - 產生聲音：可以選男聲、女聲，以及美、英、澳、印口音；
    - 用「文字＋聲音」的雜湊值當快取鍵，內容相同就直接沿用；
    - 音檔存在 Supabase Storage。
  - **d4**：
    - 播放器支援「音檔來源」，聽寫、跟讀、講義、7 天循環都適用；
    - YouTube 影片照舊。
  - **d5**：
    - Collection 和筆記本的建立、整理；
    - 每個練習可以設為公開或私人，預設私人。
- 需要 Joe 先完成清單 5，才能實際產生聲音和翻譯。在那之前程式照做，只用假的供應者測試，正式站不開放這個功能。

## e. 公開分享

- **e1**：瀏覽其他人公開的練習，可以搜尋，也可以照語言和長度篩選；可以開始練習別人公開的練習。
- **e2**：
  - 使用者可以檢舉，要選原因；
  - 管理員有審查頁，可以下架或駁回；
  - 被下架的練習不再公開，作者會看到下架的原因。

## f. 方案限制的權限設定

- **`lib/plans.ts`**：集中設定同時練習數、每月建立數、每篇字數，目前全部不限制。
- **`can(user, action)`**：程式一律透過它判斷能不能做；超過限制時，介面顯示的文字也統一放在這裡處理。
- **之後收費**：只要改設定，不用改功能程式碼。付費方案和金流不在這次範圍。

## 需要 Joe 操作的事（一次整理）

一律在自己的瀏覽器或終端機操作。**秘密金鑰不要貼進對話**，直接填到 Vercel 和 `.env.local`。

### 1. 建立 Supabase 專案（免費，不需要信用卡）

1. 到 https://supabase.com ，按「Start your project」，用 GitHub 帳號登入。
2. 按「New project」：
   - Organization 選自己的；
   - Name 填 `listenloop`；
   - Database Password 按「Generate a password」，產生後存進密碼管理器，之後第 4 步會用到；
   - Region 選「Northeast Asia (Tokyo)」；
   - 方案保持 Free；
   - 按「Create new project」，等待約 2 分鐘。
3. 左側「Project Settings → API」或「API Keys」，記下這三個值：
   - **Project URL**：`https://<ref>.supabase.co`。中間的 `<ref>` 就是專案代號，第 2、4 步會用到。
   - **anon／publishable key**：這是公開金鑰，可以貼給 Claude。
   - **service_role／secret key**：這是秘密金鑰，不要貼給 Claude，第 3 步直接填進環境變數。

### 2. 申請 Google 登入憑證（免費，不需要帳單）

1. 到 https://console.cloud.google.com ，上方選擇專案 →「新增專案」，名稱填 `ListenLoop`，然後建立。
2. 左側「API 和服務 → OAuth 同意畫面」（新版介面叫「Google Auth Platform」）→「開始」：
   - 應用程式名稱填 `ListenLoop`；
   - 使用者支援電子郵件選自己；
   - 目標對象選「外部」；
   - 聯絡資訊填自己的 email；
   - 同意政策後建立。
3. 在「品牌」頁面填寫：
   - 應用程式首頁：`https://listenloop-three.vercel.app`；
   - 隱私權政策：`https://listenloop-three.vercel.app/privacy`。這一頁會在 b4 做好，先填網址沒關係。
   - 授權網域：加 `listenloop-three.vercel.app`，再加 `<ref>.supabase.co`。
4. 在「資料存取」頁面加入範圍：`openid`、`.../auth/userinfo.email`、`.../auth/userinfo.profile`。這三個都是非敏感範圍，不需要 Google 審查。
5. 在「目標對象」頁面按「發布應用程式」，改成「實際運作中」。不發布的話，只有測試使用者能登入。
6. 「用戶端」→「建立用戶端」：
   - 類型選「網頁應用程式」，名稱填 `ListenLoop Web`；
   - 已授權的 JavaScript 來源：`https://listenloop-three.vercel.app`、`http://localhost:3000`；
   - 已授權的重新導向 URI：`https://<ref>.supabase.co/auth/v1/callback`；
   - 建立後，複製「用戶端 ID」和「用戶端密鑰」。
7. 回到 Supabase，「Authentication → Sign In / Providers → Google」：
   - 打開 Enable；
   - 貼上用戶端 ID 和密鑰，然後按 Save。
8. Supabase「Authentication → URL Configuration」：
   - Site URL 填 `https://listenloop-three.vercel.app`；
   - Redirect URLs 加入這三個：`https://listenloop-three.vercel.app/**`、`https://*-joe-53f4.vercel.app/**`（預覽網站用）、`http://localhost:3000/**`。

### 3. 填環境變數

1. 到 Vercel，進入 listenloop 專案，「Settings → Environment Variables」，Environment 勾選 Production 和 Preview，新增以下四個：

   | 名稱                            | 值                          | 備註                      |
   | ------------------------------- | --------------------------- | ------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`      | Project URL                 |                           |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon／publishable key       |                           |
   | `SUPABASE_SERVICE_ROLE_KEY`     | service_role／secret key    | 勾選「Sensitive」         |
   | `ADMIN_EMAILS`                  | 你自己登入用的 Google email | 多個 email 用英文逗號分隔 |

2. 在專案資料夾的 `.env.local` 加入同樣四行，格式是 `名稱=值`。這個檔案已經在 `.gitignore` 裡，不會上傳。
3. 完成後告訴 Claude「環境變數好了」，並貼上 Project URL。

### 4. 讓 Claude 可以套用資料庫 migration（一次性）

在這個對話的輸入框依序輸入以下兩行。開頭的 `!` 會讓指令在這個對話裡執行：

```
! npx supabase login
! npx supabase link --project-ref <ref>
```

- 第一行會開啟瀏覽器，請授權登入。
- 第二行會要求輸入第 1 步存下的 Database Password。
- 完成後，Claude 就能用 `npx supabase db push` 套用資料表。

### 5. 聲音與翻譯 API（d 才需要，可以晚點做）

**需要你明確同意**：Google Cloud 的 Text-to-Speech 和 Translation 有每月免費額度，但必須綁定帳單帳戶，也就是要信用卡。這和原本「不用需要信用卡的服務」的規則不同，所以要你同意才會導入。

- **為什麼建議用它**：
  - 有男聲、女聲，以及美、英、澳、印四種口音；
  - 和 Google 登入在同一個 Cloud 專案，比較好管理；
  - 免費額度大約是：聲音每月 Standard 400 萬字元、WaveNet 100 萬字元，翻譯每月 50 萬字元（以 Google 官方價格頁為準）；
  - 程式另外會設每日用量上限，見 decisions.md。

1. 在第 2 步建立的 `ListenLoop` 專案：左側「帳單」→ 連結帳單帳戶，依照畫面加入信用卡。
2. 「帳單 → 預算與快訊」→ 建立預算：
   - 金額 US$5；
   - 快訊門檻 50%、90%、100%，通知寄到你的 email。
3. 「API 和服務 → 程式庫」，搜尋並啟用「Cloud Text-to-Speech API」和「Cloud Translation API」。
4. 「API 和服務 → 憑證 → 建立憑證 → API 金鑰」，建立後按「編輯 API 金鑰」：
   - 「API 限制」選「限制金鑰」，只勾選上面那兩個 API；
   - 儲存。
5. 把金鑰以 `GOOGLE_CLOUD_API_KEY` 的名稱加到 Vercel（Production、Preview，勾選 Sensitive）和 `.env.local`。
6. 告訴 Claude「聲音 API 好了」。

**如果不同意**：d 的程式照做，但只用假的供應者測試，正式站不會開放建立練習。之後要改用其他供應者時，只需要換掉供應者介面的實作。
