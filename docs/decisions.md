# 決策紀錄

規格沒有定義的細節由 Claude 先選擇合理的預設，記錄在這裡（2026-10-30 起的工作規則）。Joe 想改時，告訴 Claude 編號即可，例如「改 D3」。每一筆的格式：日期、決定、理由、要改時看哪裡。

## D1 小修正和 Tears of Steel 草稿一起合併（2026-10-30）

- **決定**：roadmap 的 a 已經在 PR #35 完成，連同 Tears of Steel 的 4 支草稿一起合併。
- **理由**：
  - 草稿有 `draft: true`，不會出現在題庫，影片頁也回 404，對正式站沒有影響；
  - 拆開要重做 PR，風險反而比較高；
  - 時間點校正和審稿等內容工作恢復時再做。
- **要改時**：`data/videos/tears-of-steel-*.json` 的 `draft`。

## D2 不登入也能練習，但進度只在登入後顯示（2026-10-30；2026-11-06 修訂）

- **原本的決定**（2026-10-30）：登入是選擇性的。沒有登入時，進度照舊存在 localStorage；登入後改存雲端，可以跨裝置使用。
- **2026-11-06 修訂**（Joe 指定，e+ 8）：
  - 練習本身仍然不用登入：影片頁、每天的聽寫和跟讀都打得開，紀錄照樣存在這台裝置；
  - **進度只在登入後顯示**：首頁的練習日曆和今日任務、「學習進度」頁 `/practices`，未登入時都改成一張「登入後查看你的進度」卡片，附上登入按鈕（`ProgressGate`），並說明這台裝置的紀錄登入後會一起存進帳號（D3）；
  - 沒有設定帳號功能的環境（沒有 Supabase）照舊顯示本機進度，因為那裡根本無法登入。
- **理由**：
  - **共用裝置的隱私**：登出後，本機資料仍屬於上一個登入的帳號（D3 的 `ll-account:v1`）。未登入時還顯示進度，等於讓下一個使用者看到上一個人的練習紀錄；
  - **單一的進度來源**：產品定位是「看得見的進步」，進度跟著帳號，換裝置也一致；只在本機的進度容易因為清除瀏覽器資料而消失，使用者以為進度不見了；
  - **仍然先試用、再註冊**：練習不用登入，門檻不變；看進度是登入的理由，業界常見的「先體驗、看成果時再註冊」做法。
- **要改時**：`components/ProgressGate.tsx`、`components/StoresProvider.tsx`（`useProgressVisible`）、`app/page.tsx`、`app/practices/page.tsx`；E2E 用 `e2e/fixtures.ts` 的 `signInAsAuthor` 登入。

## D3 本機與雲端進度的合併規則（2026-10-30，2026-11-03 在 b3 修訂）

- **決定**：
  - 登入時，每次載入頁面都同步一次，不只第一次登入時搬移。第一次登入時搬移本機進度、不同裝置之間同步、斷線後補傳，都由同一套邏輯處理（`lib/sync/`）。
  - 只有一邊有的影片，就複製到另一邊。
  - 兩邊都有的影片，保留進度較多的一份。比較順序：週數 → 完成的天數 → 最後完成日期 → 進行中那一天已作答的句數。完全相同時不做任何事；進度一樣多但內容不同時，以雲端為準，讓每台裝置最後都是同一份。
  - 練習活動紀錄兩邊合併成聯集。
  - 本機的 `ll-account:v1`（`{ "userId" }`）記錄這台裝置的資料屬於哪個帳號，取代原本計畫的 `ll-migrated:v1:<userId>`：
    - 沒有記錄時，表示是訪客的資料，會併入第一個登入的帳號；
    - 記錄的是另一個帳號時，就換成目前帳號的雲端資料，不把兩個人的資料混在一起；
  - 本機資料保留，當作離線時的備份。登出後，可以繼續在這台裝置上練習。
- **理由**：
  - 不會讓任何一邊的進度變少；
  - 失敗時下次載入頁面會自動重試；
  - 共用裝置時，不會把別人的進度併進自己的帳號。
- **要改時**：`lib/sync/merge.ts`、`lib/sync/sync.ts`，都有測試。

## D4 雲端資料表結構（2026-10-30）

- **決定**：
  - `progress (user_id, video_id, data jsonb, updated_at)`，主鍵是 `(user_id, video_id)`。`data` 存的格式和 localStorage 的 `Progress` 相同，讀取時一樣用 `lib/progress.ts` 驗證。
  - 練習活動紀錄存在 `user_documents (user_id, key, data jsonb, updated_at)`，key 例如 `activity`。
  - 每張表都開啟 RLS：只有 `user_id = auth.uid()` 的人可以讀寫。
  - 刪除帳號時，用 `on delete cascade` 一起刪除這些資料。
- **理由**：
  - 沿用現有的資料格式和驗證，搬到雲端不需要改寫評分和循環的邏輯；
  - RLS 是 Supabase 建議的安全做法。
- **要改時**：`supabase/migrations/`。

## D5 管理員判斷（2026-10-30）

- **決定**：管理員名單放在環境變數 `ADMIN_EMAILS`（多個 email 用逗號分隔），只在伺服器端判斷，email 的大小寫不影響結果。
- **理由**：
  - 目前只有一位管理員，不需要另外做角色管理介面；
  - 名單只放在伺服器端，前端改不了。
- **要改時**：改用資料表記錄角色，在 e2 需要多位管理員時再評估。

## D6 聲音與翻譯 API 的預設供應者（2026-10-30；翻譯部分已由 D28 取代）

- **決定**：
  - 建議使用 Google Cloud Text-to-Speech 和 Cloud Translation，透過「供應者介面」呼叫，之後可以換成其他供應者；
  - 在 Joe 同意並提供金鑰之前，只用假的供應者測試。
- **理由**：
  - 四種口音、男聲女聲都有；
  - 和 Google 登入在同一個 Cloud 專案；
  - 有每月免費額度。
- **注意**：需要綁定信用卡，所以必須由 Joe 明確同意（見 roadmap「需要 Joe 操作的事」第 5 項）。
- **要改時**：`lib/ai/`（供應者介面在 `lib/ai/types.ts`，選擇供應者在 `lib/ai/providers.ts`，見 D20）。

## D7 每日用量上限（2026-10-30）

- **決定**：
  - 管理員每天最多產生 20,000 字元的聲音、翻譯 20,000 字元，超過就擋下並顯示提示；
  - 數字集中放在同一個設定檔；
  - 用量記錄在資料庫，以台灣時間為基準，每天 0 點歸零。
- **理由**：
  - 遠低於免費額度，就算程式出錯也不會產生大額費用；
  - 另外由 Joe 在 Google Cloud 設定 US$5 的預算快訊，作為第二道防線。
- **要改時**：`lib/usage.ts` 的 `DAILY_CHAR_LIMITS`；資料庫的計數在 `api_usage` 表和 `reserve_api_usage` 函式（`supabase/migrations/20261103120000_custom_practices.sql`）。

## D8 方案限制的範圍（2026-10-30）

- **決定**：f 只建立集中的權限設定和 `can()` 判斷，所有限制都是「不限制」；c、d 需要用到限制的地方，先不擋。
- **理由**：
  - 依照 roadmap 的順序，付費方案之後再做；
  - 先把判斷的入口統一，之後改設定就好。
- **要改時**：`lib/plans.ts`，在 f 建立。

## D9 新套件（2026-10-30）

- **決定**：roadmap 項目需要的官方 SDK 直接加入，並記錄在這裡。其他套件只在必要時加入，挑選官方或維護良好的套件，並在這裡寫明理由。
- **目前預計加入**：
  - `@supabase/supabase-js`、`@supabase/ssr`（b1）；
  - `@playwright/test`（c3，開發用）；
  - Supabase CLI 用 `npx supabase` 執行，不加入依賴。
- **要改時**：這一節。

## D10 環境變數名稱沿用 ANON_KEY（2026-11-03）

- **決定**：Supabase 新版的 Publishable key 和 Secret key，沿用 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 和 `SUPABASE_SERVICE_ROLE_KEY` 這兩個名稱，不改名。
- **理由**：
  - 新版金鑰和舊版的 anon、service_role 金鑰用途相同，SDK 兩種都能用；
  - 不改名，Joe 就不用到 Vercel 重新填一次。
- **要改時**：`lib/supabase/config.ts`、`.env.example`，以及 Vercel 的環境變數。

## D11 Supabase 地區是 us-east-1（2026-11-03）

- **決定**：保留目前專案所在的 us-east-1（美東）。
- **理由**：
  - 從台灣連線每次大約多 150～200 毫秒，但進度只在載入和完成任務時讀寫，練習時不受影響；
  - 換地區必須刪掉專案重建，而且要重新設定 Google 登入。
- **要改時**：等上線前評估。如果要換到 Tokyo，就重建專案、更新環境變數，再執行 `npm run db:push`。

## D12 RLS 驗證方式（2026-11-03）

- **決定**：每次修改 migration，都用兩個暫時的測試帳號實際檢查一次，測完刪除帳號。檢查項目：
  - 只能讀寫自己的資料；
  - 不能冒用別人的帳號寫入；
  - 未登入時無法讀寫；
  - 刪除帳號時，資料會一起刪除。
- **理由**：RLS 寫錯會讓資料外洩，單元測試又測不到資料庫，所以要實際打一次 API 確認。
- **要改時**：之後如果導入本機 Supabase（需要 Docker），改成自動化測試。

## D13 登入流程（2026-11-03）

- **決定**：
  - 使用 Supabase 的 Google OAuth（PKCE）。登入後回到 `/auth/callback`，再導回原本的頁面；
  - 要導回的網址只接受站內路徑，避免被利用來導向外部網站（open redirect）；
  - 失敗或取消時，在網址加上 `?signin=failed` 或 `?signin=cancelled`，並在頁首下方顯示提示；
  - 每次請求都由 `proxy.ts` 更新 session；伺服器端用 `getClaims()` 驗證 token 的簽章，不用 `getSession()`；
  - 帳號選單用 disclosure 模式，畫面上不顯示 Google 頭像，也就不需要載入外部圖片。
- **理由**：
  - 這是 Supabase 官方建議的 Next.js 做法；
  - 不顯示頭像可以少一個外部請求，也比較不會洩漏隱私。
- **要改時**：`app/auth/callback/route.ts`、`auth/`、`components/AccountMenu.tsx`。

## D14 同步時機與範圍（2026-11-03）

- **決定**：
  - 讀取一律從本機；每次存檔先寫本機，再送到雲端，不等雲端回應。上傳失敗不會中斷練習，下次載入頁面同步時會補傳。
  - 同步完成後，如果帶進了別台裝置的資料，頁面會重新讀取一次。
  - 魚缸的點數和飼料（`ll-wallet:v1`）不同步：魚缸功能目前暫停；恢復時再加入 `user_documents`。
- **理由**：
  - 練習不受網路速度影響（Supabase 在美東，見 D11）；
  - 離線也能用。
- **要改時**：`lib/storage/synced-stores.ts`、`components/StoresProvider.tsx`。

## D15 移除練習後的同步：用「上次同步的影片清單」判斷（2026-11-03，c1 修訂）

- **問題**：同步規則是「只有一邊有的影片就複製過去」。如果在手機移除一支練習，筆電上還留著，筆電同步時會再把它傳回雲端。
- **決定**：不使用原本計畫的「已刪除」紀錄（tombstone），改在本機的 `ll-account:v1` 記錄「上次同步完成時，兩邊都有的影片」（`synced`）。同步時：
  - 只有一邊有，而且在 `synced` 裡：表示在另一邊被移除了，所以這邊也刪除，不再複製回去；
  - 只有一邊有，而且不在 `synced` 裡：表示是新開始的練習，所以複製到另一邊。
  - 移除時如果雲端刪除失敗，下次同步會用同一條規則補刪。
- **理由**：
  - 這是三方合併（three-way merge）的做法，不需要另外的資料表或文件，也不會越積越多紀錄；
  - 舊資料沒有 `synced` 時，視為空清單，行為和之前一樣。
- **已知限制**：如果筆電在離線期間重新開始了一支「在手機上已經移除」的影片，下次同步時會被刪除。這種情況很少見。
- **要改時**：`lib/sync/merge.ts` 的 `planProgressSync`。

## D16 刪除帳號的確認方式（2026-11-03）

- **決定**：
  - 刪除前先展開確認區塊，列出會刪除的內容，勾選「我了解刪除後無法復原」後才能按「永久刪除帳號」；不要求輸入文字；
  - 伺服器只依照已驗證的 session 判斷要刪除哪個帳號，用 secret key 刪除 auth user，資料表透過 cascade 一起刪除；
  - 刪除成功後，清除這台裝置上的練習資料（主題保留），並顯示刪除完成。
- **理由**：
  - 勾選確認可以避免誤刪，又不像輸入文字那麼麻煩，手機上也好操作；
  - 請求本身不帶使用者 id，所以不能刪除別人的帳號。
- **要改時**：`components/DeleteAccount.tsx`、`auth/actions.ts`。

## D17 隱私聯絡方式暫用 GitHub Issues（2026-11-03）

- **決定**：隱私權政策的聯絡方式，暫時用 GitHub 專案的 Issues 頁，並提醒「留言是公開的，請不要寫下個人資料」。
- **理由**：沒有得到 Joe 同意前，不公開 Joe 的 email。
- **要改時**：發布 Google OAuth 前，建議改成一個專用的聯絡 email，例如另外申請一個 Gmail（見 roadmap「上線前待辦」）。要改的地方是 `app/privacy/page.tsx` 的 `PRIVACY_CONTACT_URL`，以及翻譯檔裡的 `privacy.contact`。

## D18 c2 沿用現有功能；c3 的 E2E 範圍（2026-11-03）

- **c2 的決定**：不需要新增程式。
  - 題庫卡片已經顯示目前的天數和任務，由 `ProgressLabel` 和 c1 的「我的練習」共用；
  - 影片頁已經有 `CycleStatus`；
  - 今日任務已經是「可以做」排在「今天已完成」前面。開始過的影片今天只有這兩種狀態，roadmap 寫的「還沒開放」並不存在。
- **c3 的決定**：
  - 用 Playwright（`e2e/`）對 production build 測試；
  - 擋掉 YouTube，測試不依賴外部網路；
  - 用 `page.clock` 設定日期，測試換日之後是否解鎖。
- **c3 涵蓋的情境**：
  1. 用畫面完成 Sintel 第 1 天聽寫，隔天第 2 天開放；
  2. 同時有兩支練習時，各自顯示自己的天數；移除其中一支後，另一支的進度不受影響。
- **限制**：目前只有 Sintel 一支正式影片，所以第二支練習是用 localStorage 放入一筆「已下架影片」的進度。等 Tears of Steel 上架（內容工作恢復後），再改成兩支正式影片。
- **CI**：E2E 加在 `check` job 的 build 之後，job 名稱不變。失敗時會上傳 trace，保留 7 天。
- **要改時**：`e2e/`、`playwright.config.ts`、`.github/workflows/ci.yml`。

## D19 自建練習的資料表；Collection 和筆記本的定義（2026-11-03，d1）

- **決定**：
  - **練習**（`practices`）：一份上傳的文字檔做成的練習。記錄標題、原文語言（`en` 或 `zh`）、聲音（d3 產生音檔後填入）、公開或私人（預設私人）。
  - **句子**（`practice_sentences`）：依順序存放，`en` 是要聽寫和跟讀的英文，`zh` 是講義的中文。
  - **Collection**（`collections`）：把自己的練習分組，就像內建題庫的合集。一個練習最多放在一個 Collection；刪除 Collection 時，裡面的練習保留，只是不再分組。Collection 也可以設為公開或私人。
  - **筆記本**（`notebooks`、`notebook_entries`）：使用者自己收藏單字和句子的地方，可以加上筆記，並記錄來自哪支影片或哪個練習的哪一句。筆記本一律私人。
  - **用量**（`api_usage`）：每個人、每天、聲音或翻譯各一列，記錄字元數。
  - 每張表都開啟 RLS，只能讀寫自己的資料；練習只能放進自己的 Collection，筆記只能寫進自己的筆記本。公開練習給別人看的規則在 e1 再加。
  - 用量只能看、不能改：只有伺服器用 secret key 呼叫 `reserve_api_usage` 寫入，使用者自己改不了。
  - 刪除帳號時，這些資料都透過 `on delete cascade` 一起刪除。
- **理由**：
  - 規格只寫「Collection 與筆記本」，沒有定義兩者的差別。業界常見的做法是：Collection 是內容的分組（可以分享），筆記本是個人的生詞本（不分享），這樣兩者用途不重疊；
  - 用量放在使用者改不了的地方，才能真正擋住超額使用。
- **要改時**：`supabase/migrations/20261103120000_custom_practices.sql`。如果想要「一個練習放進多個 Collection」，要改成中介表。

## D20 聲音與翻譯的供應者介面；先用假的供應者（2026-11-03，d1）

- **決定**：
  - 功能程式只呼叫 `lib/ai/types.ts` 的介面（`TranslationProvider`、`SpeechProvider`），不直接呼叫廠商的 SDK；
  - 伺服器用環境變數 `AI_PROVIDERS` 決定供應者：沒有設定時整個功能關閉；`fake` 是假的供應者（翻譯在句子前加 `[en]`，聲音是每個字 0.4 秒的無聲 WAV 檔，可以實際播放）；
  - 正式站（`VERCEL_ENV=production`）一律不使用假的供應者，就算不小心設定了也一樣；
  - 每次呼叫前，先用資料庫函式在同一個指令裡「檢查上限並加上字數」，成功才呼叫 API，避免同時送出的請求一起超過上限。呼叫失敗時，字數仍然算進用量，避免一直重試而超過上限；
  - 能不能建立練習，一律由 `auth/creator.ts` 的 `getCreator()` 判斷：已登入、是管理員（D5）、有供應者、有 secret key，四個條件都要符合。
  - 聲音的 id 格式是「口音-性別」，例如 `us-female`，口音有 `us`、`gb`、`au`、`in`。
- **理由**：
  - 測試不需要網路，也不會產生費用；
  - Joe 同意綁定帳單（清單 5）後，只需要新增一個實作，功能程式不用改。
- **要改時**：`lib/ai/`、`auth/creator.ts`。

## D21 建立練習：斷句、翻譯和上限（2026-11-03，d2）

- **決定**：
  - **入口**：`/create`，只有管理員、而且設定了供應者時才打得開（其他人看到 404，不被搜尋引擎收錄）。頁首「我的練習」右邊會多一個「建立練習」連結，也只有這些人看得到。
  - **輸入**：可以直接貼上文字，或選擇 `.txt` 檔（讀進文字框，可以再修改）。檔案必須是 UTF-8，Big5 等其他編碼會提示另存成 UTF-8；檔案最大 100 KB。沒有填標題時，用檔名當標題。
  - **原文語言**：依文字自動判斷（漢字佔字母的三分之一以上就當作中文），使用者選過之後就不再自動改。
  - **斷句**（`lib/custom-practice/split.ts`）：
    - 每一行分開處理（對話稿、講稿通常一行一句）；
    - 英文在 `. ! ? …` 後面、而且下一句是大寫字母或數字開頭時斷開；`Mr.`、`Dr.`、`U.S.`、`a.m.`、縮寫字首等不斷；
    - 中文在 `。！？；…` 後面斷開，逗號不斷；
    - 結尾的引號、括號跟著前一句。
    - 不使用瀏覽器內建的 `Intl.Segmenter`：實測它會在 `Mr.` 後面斷開，也會把中文的開引號「接到前一句。
  - **翻譯**：中文翻成英文（英文用來練習）；英文翻成中文（放進講義）。兩種都算在翻譯的每日用量裡。
  - **預覽**：每一句的英文、中文都可以修改，也可以刪除或新增句子，確認後才建立。重新斷句會再算一次翻譯用量。
  - **技術上限**（`lib/custom-practice/draft.ts` 的 `PRACTICE_LIMITS`）：每篇最多 10,000 字元、300 句，每句最多 500 字元，標題最多 100 字。這是避免資料過大的安全上限；方案限制（例如每篇字數）在 f 另外處理。
  - **儲存**：用使用者自己的 session 寫入，RLS 會檢查。先寫練習、再寫句子；句子寫入失敗時，把剛建立的練習刪掉，不留下沒有句子的練習。建立的練習預設私人。
  - 建立後先列在 `/create` 下方的「你建立的練習」。產生音檔（d3）和開始練習（d4）之後再加入。
- **理由**：
  - 斷句規則簡單、可預測，結果不滿意時使用者可以在預覽修改；
  - 英文原文也翻成中文，自建練習的講義才和內建影片一樣有中英對照。
- **要改時**：`lib/custom-practice/`、`app/create/`、`components/CreatePracticeForm.tsx`。

## D22 產生音檔：每句一個檔、內容雜湊快取、公開的 Storage（2026-11-03，d3）

- **決定**：
  - **每一句一個音檔**：聽寫和跟讀本來就是逐句播放，每句一個檔就不需要另外校正時間點。
  - **快取鍵**：`SHA-256(供應者 id + 聲音 id + 英文句子)`，檔名就是雜湊值（例如 `<hash>.mp3`）。不同練習、不同使用者只要句子和聲音相同，就共用同一個檔案，不再呼叫 API，也不算用量。
    - 供應者 id 也算進去（假的供應者是 `fake`），所以換成真的供應者時，不會誤用假的無聲檔案。供應者的輸出改變時（例如換聲音版本），改 id 即可全部重新產生。
  - **存放**：Supabase Storage 的 `speech` bucket，設為公開讀取，只有伺服器（secret key）能上傳；`speech_audio` 表記錄哪些雜湊已經有檔案，使用者看不到也改不了。每個檔最大 5 MB，只接受 MP3 和 WAV。
    - 公開而不用簽章網址的理由：檔名要知道句子內容才算得出來，等於只有已經知道內容的人拿得到；公開網址可以被 CDN 快取，播放比較快；e 的公開分享也需要讓別人播放。
  - **聲音**：在預覽步驟選擇性別和口音，預設美式女聲，存在練習上。目前建立後不能換聲音，之後需要時再加。
  - **分批產生**：瀏覽器每次請伺服器產生 8 句（`AUDIO_BATCH_SIZE`），重複呼叫直到全部完成，畫面顯示進度。每次呼叫都很短，不會超過 Vercel 的執行時間上限；中途關掉分頁、用量用完或出錯時，已產生的會保留，在「你建立的練習」按「繼續產生音檔」就從中斷的地方繼續。
  - 每一句先預扣聲音用量再呼叫 API（D20）；快取命中的句子不扣。
- **理由**：符合 CLAUDE.md「相同文字＋相同聲音只產生一次」；分批是處理長時間工作的常見做法，比一次做完更不容易失敗。
- **要改時**：`lib/custom-practice/audio.ts`、`auth/audio-store.ts`、`app/create/actions.ts` 的 `generatePracticeAudio`、`supabase/migrations/20261103180000_speech_audio.sql`。

## D23 自建練習的播放與 7 天循環（2026-11-03，d4）

- **決定**：
  - **id 與網址**：自建練習的 id 是 `p-<uuid>`，和內建影片共用同一套網址（`/videos/<id>`、`/videos/<id>/day/<n>`、`/videos/<id>/handout`）、進度格式和雲端同步。今日任務、我的練習、練習日曆、7 天循環的程式都不用分兩套。內建影片的 id 不可以用 `p-` 開頭（驗證會擋）。
  - **讀取**：頁面在伺服器用使用者自己的 session 讀取練習（RLS 只回傳自己的），所以要登入才能練習自建練習；別人或未登入時回 404。音檔沒有全部產生之前也是 404，建立頁要等「音檔已完成」才出現「開始練習」。
  - **播放器**：抽象成「逐句播放器」（`components/useSentencePlayer.ts`）。YouTube 影片照舊播放每句加上緩衝的時間範圍；自建練習用一個 `<audio>` 播放每句自己的音檔。聽寫、跟讀、重新聽寫只呼叫「播放第 N 句」，不管來源。
  - **畫面**：自建練習沒有影片，原本放影片的位置改成「聲音練習」面板（`AudioFrame`），播放時喇叭圖示變成橘色、文字改成「播放中…」；不顯示關閉字幕的提示，也不顯示影片出處。
  - **講義**：英中對照照常顯示；自建練習目前沒有單字和文法，所以那兩節不顯示。
  - **標題語言**：內建影片的標題標 `lang="en"`；自建練習的標題由使用者自己取，可能是中文，所以不標。
  - **標題來源**：首頁、我的練習、練習日曆需要自建練習的標題時，由瀏覽器向 Supabase 讀取（只有出現 `p-` 開頭的練習時才讀），內建影片的標題照舊隨程式提供。
- **理由**：
  - 共用 id 和網址，可以讓 7 天循環、評分、同步的程式和測試都不用改，風險最小；
  - 播放器抽象後，日後要支援其他來源（例如使用者上傳的音檔）也只要加一個實作。
- **已知限制**：完成畫面的「回影片頁」等按鈕文字仍然寫「影片」，之後在品質打磨時統一改成「練習」。
- **要改時**：`lib/practice-material.ts`、`auth/practice-material.ts`、`components/useSentencePlayer.ts`、`components/audio/`。

## D24 整理自建練習：Collection、公開／私人、刪除（2026-11-03，d5a）

- **決定**：
  - 都在 `/create` 頁的「你建立的練習」和「Collection」兩節完成，只開放給管理員（`auth/creator.ts` 的 `getAdminUser()`；這些操作不呼叫付費 API，所以不需要設定供應者）。
  - **Collection**：可以新增、重新命名、刪除、設為公開或私人。刪除 Collection 時，裡面的練習保留，改成「未分組」。練習清單依 Collection 分組（依建立順序），最後是「未分組」；還沒有 Collection 時不顯示分組標題。
  - **移動練習**：每個練習用下拉選單選擇 Collection，選了就儲存。
  - **公開／私人**：練習和 Collection 都可以切換，預設私人。切換後畫面先更新，儲存失敗時改回原本的設定並顯示原因。目前公開不會讓別人看到，e1 的公開瀏覽推出後才會生效，頁面上有說明。
  - **刪除練習**：要先確認。句子一起刪除；共用快取的音檔保留（其他練習可能用到）；裝置上的練習進度照舊留著，可以在「我的練習」移除，和下架的影片一樣。
  - 所有寫入都用使用者自己的 session，RLS 會檢查；寫入時沒有對到任何一列，就回報「找不到」（不是自己的，或已經刪除）。
- **理由**：整理功能放在建立的同一頁，管理員不用在不同頁面之間切換；刪除用確認區塊，和「我的練習」的移除一致。
- **要改時**：`app/create/organize-actions.ts`、`components/CollectionManager.tsx`、`components/PracticeControls.tsx`、`components/VisibilityToggle.tsx`。

## D25 筆記本（2026-11-03，d5b）

- **決定**：
  - `/notebooks` 列出筆記本，可以新增；`/notebooks/<id>` 可以新增筆記（單字或句子＋選填的筆記）、刪除筆記、重新命名或刪除筆記本。刪除筆記本要先確認，刪除單一筆記不需要確認（內容很短，重新加入也很容易）。
  - 筆記本一律私人，只有自己看得到（RLS）。別人的筆記本網址回 404。
  - 目前只開放給管理員，頁首「我的練習」右邊會出現「筆記本」。筆記本不呼叫付費 API，所以不需要設定供應者：Joe 用管理員帳號登入正式站就能使用。
  - 筆記的內容標成 `lang="en"`（收藏的是英文單字和句子）；筆記保留換行。
  - 整理用的伺服器動作共用 `auth/admin-writes.ts`（管理員判斷、使用者自己的 session、沒有對到任何一列就回報「找不到」）。
- **之後再做**：從講義或聽寫回饋直接「加入筆記本」，並記錄來源（`notebook_entries.source`、`sentence` 欄位已經預留）。
- **理由**：先做最基本的建立和整理，讓資料結構和權限先經過實際使用；開放給所有登入的使用者時，只要拿掉管理員判斷。
- **要改時**：`app/notebooks/`、`components/NotebookControls.tsx`、`auth/admin-writes.ts`。

## D26 聲音卡片；「學習進度」「我的教材」（2026-11-03，d6）

- **聲音卡片**：8 個聲音用卡片呈現，依口音分組，每張卡片可以試聽（規格見 `docs/design-system.md` 的「聲音卡片」）。
  - 試聽的範例句是預先產生的 MP3，放在 `public/voices/`，等接上 Text-to-Speech 後產生（d6e）。這樣試聽不用等待，也不會用到每日額度。
  - 在那之前，`/styleguide` 先播放無聲的示範檔，只用來展示播放狀態。
- **頁首命名**（Joe 2026-11-03 選定）：
  - 「學習進度」：原本的「我的練習」，`/practices`；
  - 「我的教材」：自建練習和 Collection（d6b）；
  - 「筆記本」：不變。
  - 「建立練習」改成「我的教材」頁內的按鈕。
- **理由**：「進度」和「教材」的用途一眼就分得開，不會因為兩個都叫「練習」而混淆。
- **要改時**：`components/VoicePicker.tsx`、`components/SiteHeader.tsx`、翻譯檔的 `common`。

## D27 自建練習的講解：翻譯、單字、文法（2026-11-03，d6c）

- **決定**：
  - 自建練習和內建影片一樣有 `vocab`、`grammar`，格式也相同。聽寫每句送出後的講解、雙語講義、PDF 都直接沿用內建影片的元件。
  - **流程**：
    1. 斷句後翻譯，使用者在預覽頁修改；
    2. 按「建立練習」後，依照**修改後的英文**產生單字和文法；
    3. 產生音檔。
    - 講解和音檔都完成，才能開始練習。
  - **中文輸入的中文對照**：保留使用者原本寫的中文，不重新翻譯。
  - **產生的數量**：和內建題庫一致，每句最多 2 個單字、1 個文法重點；例句要另外造一句。
  - **檢查**：AI 回傳的每一筆都會檢查（欄位不能缺、長度上限、句子索引要在範圍內），不合格的單筆丟掉。單字和文法重點重複時只留一個（講義用它們當 key）。讀回資料庫時再檢查一次。
  - **快取**：翻譯和講解都存在 `ai_cache`，快取鍵是 `SHA-256(種類＋供應者 id（含模型與提示版本）＋內容)`。相同內容不會再呼叫 API，也不算用量。講解每 40 句呼叫一次、每段分別快取，所以失敗後重試只會重做沒完成的段落。
  - **用量**：翻譯和講解都算在「翻譯」額度，以送出的英文或原文字元數計算；每日上限不變（D7）。
  - **錯誤**：供應者忙碌（速率限制）時顯示「AI 服務目前忙碌中」，和用量用完分開提示。
  - `practices.notes_generated_at` 是空的，代表還沒產生講解；這和「產生了但沒有可以講解的內容」不同。
- **理由**：講解依照最後的句子產生，一定對得上；快取和分段可以避免重複付費，也比較不容易失敗。
- **要改時**：`lib/custom-practice/notes.ts`、`app/materials/actions.ts` 的 `generatePracticeNotes`、`components/practice-generation.ts`、`supabase/migrations/20261103200000_practice_notes.sql`。

## D28 供應者：Gemini（翻譯、講解）＋ Cloud Text-to-Speech（聲音）（2026-11-03，d6d）

- **決定**（Joe 2026-11-03 指定）：
  - **翻譯和講解**：Gemini API（Google AI Studio 的免費方案，不用綁卡）。
    - 模型是 `gemini-3.6-flash`：2026-11-03 查官方模型頁，這是穩定版而且有免費方案。集中在 `lib/ai/gemini.ts` 的 `GEMINI_MODEL`；
    - 用官方 REST `generateContent` 和 JSON schema 結構化輸出，不加 SDK 套件；
    - 提示詞寫明：給臺灣學生、臺灣用語、每句最多 2 個單字和 1 個文法、例句要另外造句。
  - **聲音**：Cloud Text-to-Speech，只用 Standard 語音（免費額度最高）。8 個聲音的對照在 `lib/ai/voices.ts`，語音名稱取自官方語音清單。（2026-11-03 改成 Chirp 3 HD，見 D29。）
  - **金鑰**：`GEMINI_API_KEY`、`GOOGLE_CLOUD_API_KEY`，兩把都有才開放建立練習。金鑰放在 HTTP header，不放在網址裡，避免出現在紀錄中。`AI_PROVIDERS=fake` 仍然可以強制使用假的供應者，但正式站一律不用。
  - **錯誤分類**：
    - HTTP 429、503 視為「忙碌」，提示稍後再試；
    - 400～404（金鑰錯誤、API 沒有啟用、模型名稱錯誤）視為設定問題。畫面上直接提示檢查哪兩個環境變數（目前只有管理員會看到）；Google 回傳的詳細訊息只寫進伺服器紀錄；
    - 其他都算失敗。
    - 每次請求最多等 60 秒。
  - **快取**：供應者 id 含模型和提示版本（`gemini/gemini-3.6-flash/p1`、`google-tts/standard/v1`）。改模型、提示詞或聲音時改版本號，就不會沿用舊的快取。
- **條款注意**（2026-11-03 查 Gemini API 條款）：
  - 免費方案的內容可能被 Google 用來改善產品，也可能經過人工審閱。隱私權政策和建立頁都已說明，並提醒不要輸入個人資料。（2026-11-03 Joe 改用付費方案，見 D29。）
  - 使用者需年滿 18 歲。目前只開放管理員；開放給一般使用者前要重新評估（roadmap「上線前待辦」）。
- **要改時**：`lib/ai/gemini.ts`、`lib/ai/google-tts.ts`、`lib/ai/voices.ts`、`lib/ai/providers.ts`。

## D29 聲音改用 Chirp 3 HD；Gemini 改用付費方案（2026-11-03，d6e）

- **聲音類型**（Joe 2026-11-03 聽過比較後選定）：
  - 實測：同一個聲音名稱（例如 `en-US-*-F`）的 Standard、WaveNet、Neural2，產生的音檔長度完全相同，Standard 和 Neural2 的檔案常常每個位元都一樣，聽不出差別。真正不同的是 Chirp 3 HD。
  - 改用 Chirp 3 HD，每種口音都用同樣兩位說話者：女聲 Kore、男聲 Charon，口音之間比較好比較。對照在 `lib/ai/voices.ts`。
  - 價格（2026-11-03 查官方價格頁）：Chirp 3 HD 每月免費 100 萬字元，之後 US$30／百萬字元；Standard 和 WaveNet 共用每月 400 萬字元，之後 US$4／百萬。每日上限 20,000 字元（D7），一個人一個月最多約 62 萬字元，在免費額度內。
  - 供應者 id 改成 `google-tts/chirp3-hd/v1`，之前產生的 Standard 音檔不會被沿用。
- **試聽範例**：`npm run voices:samples` 用真的 Text-to-Speech 產生 8 個 MP3（每個約 25 KB），放在 `public/voices/`，隨程式發布。試聽不用等待，也不算用量。換聲音後要重新產生；測試會檢查每個聲音都有範例。
- **Gemini 付費方案**（Joe 2026-11-03 決定，Tier 1，專案設了 US$1 的支出上限）：
  - 依 Gemini API 條款，付費方案的內容不會被用來改善產品，只會保留一段有限的時間，用來偵測違反使用政策的行為。隱私權政策和建立頁已經改寫。
  - 年滿 18 歲的規定付費方案也適用，所以「上線前待辦」仍保留。
  - 付費方案預設是預付制：餘額用完時，Gemini 回傳 HTTP 402。程式把 402 歸在設定問題，管理員會看到「設定或帳單有問題」的提示。
- **要改時**：`lib/ai/voices.ts`、`lib/ai/google-tts.ts` 的 `GOOGLE_TTS_ID`、`scripts/voice-samples.mts`、隱私權政策（`messages/*.json` 的 `privacy`）。

## D30 公開分享：瀏覽公開教材（2026-11-04，e1）

- **決定**：
  - **誰看得到**：所有人，不用登入。不登入也能練習別人公開的練習，進度和內建影片一樣先存在瀏覽器，登入後同步（D23 的 `p-<uuid>`）。頁面是 `/explore`，頁首叫「公開教材」，和「我的教材」對應。
  - **資料庫**：新增兩條只能讀的 RLS 規則：`visibility = 'public'` 的練習和它的句子，`anon` 和 `authenticated` 都能讀。寫入仍然只有作者本人。
    - 未登入的人只能讀指定的欄位（column grant），讀不到作者 id、Collection 和更新時間。登入的人技術上讀得到作者 id（一串 uuid，不是 email）；畫面上一律不顯示作者。
    - 判斷「你建立的」：登入時另外查一次「自己的公開練習」，不靠作者 id 傳到瀏覽器。
  - **原本依賴 RLS「只回傳自己的」的查詢都加上 `user_id` 條件**：「我的教材」的清單、產生講解和音檔的兩個 Server Action。否則管理員會看到，甚至花用量去產生別人的公開練習。單元測試會檢查查詢有帶上 `user_id`。
  - **列出條件**：講解和音檔都完成才列出；最新的 200 份（`PUBLIC_PRACTICES_LIMIT`），之後數量多了再改成分頁或伺服器端搜尋。
  - **搜尋與篩選**：在瀏覽器裡篩選伺服器送來的清單：標題搜尋、原文語言、長度。自建練習沒有時間點，所以長度用句數分組：10 句以內、11～30 句、31 句以上（`SENTENCE_BUCKETS`）。篩選狀態不存在網址，比題庫簡單；之後需要分享篩選結果時再改。
  - **搜尋引擎**：自建和公開的練習頁（總覽、每天、講義）都設 `noindex`，避免使用者內容被索引（`practiceRobots`）。`/explore` 本身可以被索引。
  - **作者不顯示**：學生使用者，先不公開任何身分資訊；之後如果需要「作者名稱」，要另外加「公開顯示名稱」欄位，讓使用者自己決定。
  - 公開的 Collection 這次先不列出，之後需要時再加。
- **要改時**：`supabase/migrations/20261104090000_public_practices.sql`、`auth/public-practices.ts`、`lib/custom-practice/explore.ts`、`components/ExploreList.tsx`、`app/explore/page.tsx`。

## D31 檢舉與下架（2026-11-04，e2）

- **決定**：
  - **誰能檢舉**：登入的使用者，只能檢舉別人公開的練習。不能檢舉自己的、私人的或已下架的練習（RLS 擋下）。每人每份練習同時只能有一則待處理的檢舉（唯一索引），每天最多 20 則（台灣時間，`REPORT_LIMITS`），避免濫用。
  - **原因**：侵權、不當內容、含有個人資料、廣告或垃圾內容、其他，可以加最多 1,000 字的補充說明。目標使用者是學生，所以把「含有個人資料」獨立成一個原因。
  - **審查**：管理員在 `/admin/reports` 依練習查看待處理的檢舉。可以選原因下架，也可以駁回；已下架的可以恢復。審查頁和這些動作都用 secret key 在伺服器執行，一般使用者讀不到檢舉，也改不了別人的練習。
  - **下架**：`practices.removed_at`、`removed_reason`（必須一起設定）。公開讀取的 RLS 規則改成排除已下架的練習。用 trigger 保證只有伺服器（或 Supabase 後台）能設定或清除下架，作者不能自己恢復。作者仍然看得到、也能練習自己的練習，並會在「我的教材」看到原因；「私人 / 公開」切換會隱藏。
  - **不自動下架**：檢舉數達到某個數字也不會自動下架，一律由管理員判斷（避免被惡意檢舉）。目前也不寄通知信。
  - **隱私**：作者看不到是誰檢舉的。審查頁也不顯示檢舉人，只顯示日期、原因和說明。隱私權政策已補上公開與檢舉的資料說明。
- **要改時**：`supabase/migrations/20261104120000_practice_reports.sql`、`lib/moderation.ts`、`app/reports/actions.ts`、`app/admin/reports/`、`components/ReportPractice.tsx`、`components/ModerationControls.tsx`。

## D32 未完成的自建練習不再顯示 404；E2E 用假的 Supabase（2026-11-04，e 驗收修正 1）

- **問題**：首頁「今日任務」的 test001「第 2 天 跟讀」打開是 404。test001 建立於講解功能（d6c）上線前，`notes_generated_at` 是空的；d6c 之後，「講解或音檔還沒完成」的練習在伺服器端被當成「不存在」。今日任務只看進度和標題，連結照樣出現。建立時中斷（關掉分頁、當天用量用完）的練習也會遇到同樣的問題。
- **決定**：
  - `auth/practice-material.ts` 的 `getPracticeState` 分成三種：可以練習、準備中（只有作者本人看得到）、不存在（404）。別人未完成的練習仍是 404。
  - 練習總覽、第 1～7 天、講義頁遇到「準備中」時，顯示「這個練習還在準備中」和 `PracticeReadiness`，可以在原地按「繼續產生」，完成後頁面重新整理就進入練習（`components/PracticePreparing.tsx`）。
  - **E2E 用假的 Supabase**（`e2e/mock-supabase/`）：自建練習的頁面在伺服器端讀 Supabase，Playwright 攔不到伺服器發出的請求，所以 E2E 啟動一個只回應必要查詢的假伺服器（練習資料在 `practices.json`，音檔一律是 1 秒無聲 WAV，接受任何登入憑證並視為練習的作者）。這是業界常見的做法（例如 WireMock、MSW）：不碰正式資料、不花錢、結果固定。E2E 用 `npm run build:e2e`（把 `NEXT_PUBLIC_SUPABASE_URL` 指向 `http://localhost:54329`）；CI 的 build 也改用它，正式站由 Vercel 自己 build，不受影響。
  - 為了讓假伺服器可以用 http，`readSupabaseConfig` 允許本機（`localhost`、`127.0.0.1`）的 http 網址，其他一律要 https。
- **要改時**：`auth/practice-material.ts`、`components/PracticePreparing.tsx`、`e2e/mock-supabase/`、`e2e/custom-practice.spec.ts`、`playwright.config.ts`、`package.json` 的 `build:e2e`。

## D33 等待時的百分比進度（2026-11-04，e 驗收修正 2）

- **決定**：
  - 進度只由實際完成的工作計算（句數），不用計時器或「假裝在跑」的動畫。
  - 為了有真實的中間數字，伺服器的工作拆小：`prepareSentences` 拆成 `splitText`（斷句）和 `translateSentences`（每批 `TRANSLATE_BATCH = 8` 句，各自快取）；講解改成一次一段（`NOTES_CHUNK` 從 40 改成 10 句），`generatePracticeNotes` 每次只多做一段、回傳 `annotated / total`，最後一次才存進資料庫；音檔照舊逐批。用戶端在 `components/practice-generation.ts` 依序呼叫並回報。
  - 整體百分比：斷句並翻譯 = 已翻譯句數 ÷ 句數（斷句完成前 0%）；建立練習 = 講解佔前 50%、音檔佔後 50%。
  - 顯示用既有的 `ProgressBar`，新增百分比模式；元件 `StageProgress` 組合步驟文字與百分比。
  - 業界做法：長時間的工作拆成小批次，每批回報進度（例如上傳、轉檔），使用者知道系統還在動、大約還要多久；批次小也讓中斷後可以從斷點繼續。
- **要改時**：`components/practice-generation.ts`、`components/StageProgress.tsx`、`app/materials/actions.ts`、`lib/custom-practice/notes.ts`（`TRANSLATE_BATCH`、`NOTES_CHUNK`）。

## D34 聲音選單（2026-11-04，e 驗收修正 3a）

- **決定**：
  - 聲音選擇改成類似 Apple 的彈出式選單 `VoiceMenu`，依口音分組，每組附一句口音特色，每個聲音顯示名稱（Kore／Charon，取自 Google 的 Chirp 3 HD 聲音名稱，`voiceDisplayName`）和性別，旁邊有試聽按鈕。先放在 `/styleguide` 給 Joe 確認，確認後（3b）才取代建立練習的聲音卡片。
  - **無障礙**：選項旁邊有試聽按鈕，`role="listbox"` 的選項裡不能放互動元件，所以用「按鈕＋展開面板（`aria-expanded`）＋原生 radio 群組」，方向鍵、Enter、Esc 的行為和原生選單接近。方向鍵切換 radio 時瀏覽器也會送出 click（`detail` 是 0），所以只有真正的滑鼠點擊（`detail` > 0）才關閉選單。
  - 試聽播放器抽成 `useSamplePlayer`，卡片和選單共用。
  - 浮動面板沿用「無陰影」原則，用 1px 邊框和 surface 底色與頁面區隔。
- **要改時**：`components/VoiceMenu.tsx`、`components/useSamplePlayer.ts`、`lib/ai/voices.ts`、翻譯檔 `voicePicker.accentNotes`。

## D35 用 Gemini 依語意斷句；預覽可以合併、拆分（2026-11-04，e 驗收修正 4）

- **決定**：
  - **斷句交給語言模型**：`LanguageProvider.segment` 把每一行切成句子（每行一組，不跨行），指示中寫明不可切斷縮寫、數字、時間、金額、引號和專有名詞，每句約 5～25 個英文字（中文原文以「翻成英文約 5～25 字」為準），太長在子句處拆。
  - **模型只能切、不能改**：每一行的切法接起來（忽略空白）必須和原文完全相同，否則那一行改用規則斷句（`checkedSegments`）。整個呼叫失敗（忙碌、上限、設定問題）時也用規則斷句，所以斷句本身不會失敗；後面的翻譯步驟才會回報上限或設定問題。
  - **規則斷句加強**：超過 25 個字的英文句子，在最接近中間的子句處（`;`、`:`、逗號後的 and、but、because、which…）再拆，兩邊都至少 5 個字才拆；找不到就保持一整句。
  - **快取**：`ai_cache.kind` 新增 `segmentation`（migration 只放寬允許值）；計入語言模型的每日用量。
  - **每日上限**：斷句、翻譯、講解、AI 生成文字都算在語言模型的用量裡，10,000 字的上傳一次就可能用掉 20,000，所以從 20,000 調高到 60,000 字元（Gemini Flash 的成本很低；Google 端另有 Joe 設定的每月支出上限）。
  - **預覽**：每句可以「與下一句合併」（英文以空格連接，中文直接連接）和「從游標處拆分」（英文框游標處拆成兩句，新的一句中文留空）。建立時，中文留空的句子在伺服器端自動從英文翻譯（計入用量、有快取），所以使用者不必手動補。中文原文的練習拆分後，新句子的中文也是翻譯出來的。
- **測試**：`tests/custom-practice-split.test.ts` 的「hard sentences」收錄難斷的例句（Dr.／a.m.／U.S.、$3.5／Ph.D.／e.g.／No. 5、刪節號、引號、對話、40 字長句、中文引號），以及模型改字、漏字、多字時退回規則的情況。
- **已知**：2026-11-04 用真的 Gemini 實測時遇到 Google 的每月支出上限（roadmap 清單 5D），等 Joe 調高後補測。
- **要改時**：`lib/ai/gemini.ts`（`SEGMENT_INSTRUCTIONS`）、`lib/custom-practice/split.ts`、`lib/custom-practice/notes.ts`（`segmentCached`）、`lib/custom-practice/draft.ts`（合併、拆分）、`lib/usage.ts`。

## D36 AI 生成練習文字（2026-11-04，e 驗收修正 5）

- **決定**：
  - 「建立練習」新增第二種文字來源「AI 生成」：選類別與情境、程度、長度、形式，可以加主題或關鍵字（中英文都可以），由 Gemini 寫英文文字。結果填進原本的標題和文字框，可以修改，接著走原本的「斷句並翻譯 → 預覽 → 建立」，不另做一套流程。
  - **集中設定**：`lib/custom-practice/generation.ts` 的 `GENERATION_CATEGORIES`（8 類，每類幾個情境；每個情境有一句給模型的英文描述）、`GENERATION_LEVELS`（初級 A2、中級 B1、高級 B2～C1）、`GENERATION_MINUTES`（約 1、3、5 分鐘）、`GENERATION_FORMATS`（對話、獨白）。要加類別或情境，只要在這裡加一筆，並在翻譯檔 `generate.categories`、`generate.scenarios` 加名稱（測試會檢查兩種語言都有）。
  - **長度**：Chirp 3 HD 每分鐘約念 130 字（`WORDS_PER_MINUTE`），所以 1／3／5 分鐘約 130／390／650 字；聽寫時每句之間的停頓不算在內。
  - **格式**：每行一句（獨白）或一個人的一次發言（對話），不加說話者名字，這樣斷句和聽寫都不會出現「A:」。指示中要求虛構人名與細節、不寫真實人物、品牌或時事，內容適合學生。
  - **檢查**：要有標題、至少一行英文、字數至少是要求的 40%，而且不超過上傳上限（10,000 字元），否則顯示「生成的內容無法使用」。
  - **用量與權限**：只開放管理員（`getCreator`）；呼叫前先預扣「預估輸出字元數」（字數 × 6 ＋ 主題長度）到語言模型的每日用量。不快取，因為每次都應該是新的內容；temperature 0.9，讓內容有變化。
  - **已知限制**：對話目前用同一個聲音念。之後可以讓每一句記錄說話者，用兩個聲音產生音檔。
- **要改時**：`lib/custom-practice/generation.ts`、`lib/ai/gemini.ts`（`COMPOSE_INSTRUCTIONS`）、`app/materials/actions.ts`（`generatePracticeText`）、`components/GenerateTextPanel.tsx`。

## D37 供應者改用 Azure；兩個資源都在 UAE North（2026-11-05，e+ 6）

- **決定**（Joe 2026-11-05 指定改用 Azure for Students）：
  - 聲音用 Azure Speech 神經語音，F0 免費方案；
  - AI 文字用 Azure OpenAI 的 `gpt-5-mini`（Global Standard）。部署不了時，退回 `gpt-4.1-mini`，或文字繼續用 Gemini；
  - 用環境變數 `AI_LANGUAGE_PROVIDER`、`AI_SPEECH_PROVIDER` 分別切換，預設 `azure`，Google 保留作為備用；
  - `gpt-4.1-nano` 已經不能新部署，所以不考慮。
- **區域**：
  - 學生方案只允許 `uaenorth`、`indiasouthcentral`、`eastasia`、`centralindia`、`malaysiawest`（Joe 實測）；
  - 官方區域表（2026-11-05 查）中，五個區域只有 `uaenorth` 有 Global Standard 的 gpt-5-mini 和 gpt-4.1-mini。Speech 神經語音在 `uaenorth`、`eastasia`、`centralindia` 都有，另外兩區沒有；
  - 兩個資源都建在 `uaenorth`，集中在同一個地方管理。
- **延遲的考量**：
  - 呼叫 Azure 的是 Vercel 的伺服器函式（預設在美東 iad1），不是使用者的瀏覽器。所以要比較的是美東到 Azure 的距離，不是台灣到 Azure 的距離。
  - 美東到 `uaenorth`、`eastasia`、`centralindia`，每次往返大約都是 200 毫秒，差別不大。
  - AI 文字一次呼叫要好幾秒，多 0.2 秒影響不大，而且 Global Standard 會自動選處理的區域。
  - 聲音一句一個請求，每批 8 句依序產生，一批大約多 1.6 秒，可以接受。
  - 練習時播放的是 Supabase Storage 裡已經產生的音檔，不經過 Azure，所以學生聽音檔完全不受影響。
  - 所以不為了延遲把 Speech 放到 `eastasia`。
- **要改時**：
  - 換區域時，在新區域重建資源，更新 `AZURE_SPEECH_REGION`、`AZURE_OPENAI_ENDPOINT` 和金鑰；
  - 設定步驟在 `docs/roadmap.md` 清單 6。

## D38 每次呼叫記錄用量；每日上限改用估算費用（2026-11-05，e+ 6 PR 1）

- **決定**（Joe 2026-11-05 指定）：
  - **供應者回報用量**：每個方法回傳 `{ value, usage }`，`usage` 是 token 數（推理或思考的 token 算在輸出）、字元數和估算費用。
    - Gemini 讀 `usageMetadata`；
    - Cloud TTS 依字元數，以超過免費額度後的牌價 US$30／百萬字元計算，寧可估高；
    - 假的供應者全部是 0。
  - **價格**：集中在 `lib/ai/pricing.ts`，2026-11-05 查證。
    - Azure 用官方的 retail prices API（`prices.azure.com`，uaenorth Global Standard）：gpt-5-mini 輸入 US$0.25、輸出 2.00，gpt-4.1-mini 0.40／1.60（每百萬 token）；
    - Gemini 3.6 Flash 是 0.75／3.75，2027 年起加倍；
    - Azure Speech F0 是 0。
  - **每次呼叫的大小上限**：集中在 `lib/ai/budgets.ts`，輸出 token 上限會送給模型（Gemini 的 `maxOutputTokens`）。
    - 翻譯：字數 ×1.5 ＋ 200，最多 8,000；
    - 講解：每句 200 ＋ 300，最多 6,000；
    - 斷句：字數 ＋ 200，最多 8,000；
    - 生成：字數 ×2 ＋ 300，最多 3,000。
  - **每日上限**（每人，台灣時間）：
    - 語言模型：估算費用 US$0.50（以 micro-dollar 整數存）。一篇 1 萬字的練習用 gpt-5-mini 約 US$0.03；
    - 聲音：16,000 字元，F0 每月 50 萬字元 ÷ 31 天，原本是 20,000。
  - **扣額度的流程**：
    1. 先預留最壞情況：輸入字元數（含約 2,000 字的指示）全部當成 token，加上整個輸出上限；
    2. 呼叫完用實際用量結算，退回多預留的部分；
    3. 失敗而且沒有用量資料時，預留的不退（D7）；失敗但供應者回報了用量（例如被截斷），就照實際用量結算；
    4. 結算或記錄失敗時，不影響呼叫的結果，只寫進伺服器紀錄。
  - **資料表**：
    - `api_daily_cost`：每人每天的費用，由 `reserve_api_cost`、`settle_api_cost` 原子性地更新；
    - `api_calls`：每次呼叫一筆，只記數字，不記送出的文字。刪除帳號時，`user_id` 改成 null 但保留紀錄，讓學生額度的累計正確；
    - `api_usage_totals`：在資料庫加總，不受 API 每次最多 1,000 列的限制；
    - 這些都只有 service_role 能讀寫。2026-11-05 已用公開金鑰確認一般使用者被拒絕。
  - **管理員頁 `/admin/usage`**：
    - 今天的費用與上限、本月費用、學生額度估計剩餘（US$100 減去 Azure 累計）、本月 Azure 聲音字元和 50 萬的比較；
    - 最近 50 次呼叫；
    - 入口在「我的教材」，「檢舉審查」旁邊。
  - **測試不呼叫真的 API**：`tests/setup-network.ts` 擋掉 Azure 和 Google 的網址；Playwright 強制使用假的供應者並清空金鑰。規則寫在 CLAUDE.md。
- **理由**：
  - 依 token 計費的模型，字數和花費不成正比：輸出、推理 token 比輸入貴 8 倍，所以上限要用費用來控制；
  - 「先預留、後結算」是額度控制的常見做法，不會因為同時送出多個請求而超過上限；
  - 只記數字不記內容，也符合隱私的最小化原則。
- **要改時**：
  - 價格：`lib/ai/pricing.ts`；
  - 上限：`lib/usage.ts`；
  - 輸出上限：`lib/ai/budgets.ts`；
  - 頁面：`app/admin/usage/page.tsx`、`lib/usage-report.ts`；
  - 資料表：`supabase/migrations/20261105090000_api_cost.sql`、`20261105100000_api_usage_totals.sql`。

## D39 聲音改用 Azure Speech（F0）；忙碌時自動等待（2026-11-05，e+ 6 PR 2）

- **決定**：
  - **供應者**：Azure Speech 的 REST API，一句一個請求，輸出 MP3（`audio-24khz-48kbitrate-mono-mp3`）。不加 SDK 套件，和 D28 的做法一致。
    - 文字放進 SSML 前先做 XML 跳脫，文字只會被念出來，不會被當成標記；
    - 區域只接受小寫英文字母和數字，避免網址被注入。
  - **聲音**：每個口音一女一男，都是一般的 Neural 語音。HD 語音沒有 en-AU 和 en-IN。2026-11-05 用 uaenorth 的語音清單 API 確認 8 個都是 GA；這個 API 免費，不算字元：

    | 口音 | 女聲    | 男聲    |
    | ---- | ------- | ------- |
    | 美式 | Ava     | Andrew  |
    | 英式 | Sonia   | Ryan    |
    | 澳洲 | Natasha | William |
    | 印度 | Neerja  | Prabhat |

  - **聲音選單的名字**：改用 Azure 的名字（例如「Ava」），由 `voiceDisplayName` 從 `AZURE_VOICES` 取出。試聽範例要在 PR 4 用 Azure 重新產生，在那之前播放的還是舊的 Chirp 3 HD 範例。
  - **切換**：`AI_SPEECH_PROVIDER` 是 `azure`（預設）或 `google`；`AI_LANGUAGE_PROVIDER` 在 PR 3 之前預設 `google`。值拼錯時視為沒有設定，建立練習會關閉，不會悄悄改用另一家。
  - **快取**：供應者 id 是 `azure-tts/neural/v1`，不會沿用 Chirp 3 HD 的音檔。
  - **錯誤**：401、403（包括 F0 每月額度用完、學生額度用完）是設定問題；429、503 是忙碌。內容過濾（400 加上 `content_filter`）算失敗，因為問題在文字本身，不在設定。這部分寫在共用的 `postToProvider`（`lib/ai/http.ts`）。
  - **忙碌時自動等待**：F0 每 60 秒最多 20 次請求，而且不能調高（官方 quotas 頁，2026-11-05）。
    - 一批音檔遇到 429 時，瀏覽器依序等 20、30、60、60 秒後再試；
    - 只要有新的進度，等待就重新從 20 秒開始；
    - 等待時，進度條顯示「語音服務忙碌，20 秒後自動繼續（4/12 句）」；
    - 四次都失敗才顯示「忙碌」。
  - **每日上限**：16,000 字元（D38）。
- **理由**：
  - 遇到 429 時退避重試，是 Azure 官方建議的做法；
  - 用浮動的等待時間，比固定每 3 秒送一次單純，也不會在不忙的時候拖慢速度。
- **要改時**：
  - 聲音：`lib/ai/voices.ts`（`AZURE_VOICES`；改了要調高 `AZURE_TTS_ID`，並重新產生範例）；
  - 供應者：`lib/ai/azure-speech.ts`、`lib/ai/providers.ts`；
  - 重試：`components/practice-generation.ts` 的 `BUSY_RETRY_SECONDS`；
  - 範例：`scripts/voice-samples.mts`（預設只印預估，加 `--yes` 才呼叫）。

## D40 AI 文字改用 Azure OpenAI gpt-5-mini（2026-11-06，e+ 6 PR 3）

- **決定**：
  - **API**：Azure OpenAI 的 v1 chat completions（`{endpoint}/openai/v1/chat/completions`），header `api-key`，`model` 填部署名稱。不加 SDK 套件。
  - **結構化輸出**：`response_format` 用 `json_schema`、`strict: true`。四個 schema（翻譯、講解、斷句、生成）在 `AZURE_SCHEMAS`，每個物件的欄位都必填，也不允許其他欄位（strict 模式的要求）。
  - **提示詞**：抽到 `lib/ai/prompts.ts`，Gemini 和 Azure 共用同一份。`PROMPT_VERSION` 仍然是 1，所以 Gemini 的快取不受影響。
  - **模型設定**（`AZURE_MODEL_SETTINGS`）：
    - gpt-5-mini 是推理模型：送 `reasoning_effort: "minimal"`，節省推理 token；不能設定 temperature，所以「生成文字」的變化度用模型預設；
    - gpt-4.1-mini（備選）送 temperature（翻譯 0.2、生成 0.9）。
  - **只用有價格的模型**：`AZURE_OPENAI_MODEL` 必須同時在 `AZURE_MODEL_SETTINGS` 和 `LANGUAGE_PRICES` 裡，否則視為沒有設定，建立練習會關閉，避免出現沒有計費的呼叫（D38）。
  - **端點**：只接受 https，而且主機是 `*.openai.azure.com` 或 `*.cognitiveservices.azure.com`。
  - **失敗**：
    - `finish_reason` 是 `length`（被輸出上限截斷）、`content_filter`，或模型拒絕、回答不是 JSON，都算失敗；
    - 這些失敗仍然回報用量，照實際用量扣額度；
    - HTTP 錯誤的分類同 D39。
  - **預設**：`AI_LANGUAGE_PROVIDER` 預設 `azure`；設成 `google` 可以改回 Gemini。
  - **隱私權政策**（2026-11-06 更新）：
    - 文字送到 Azure OpenAI 和 Azure Speech，不會被用來訓練模型；
    - Azure OpenAI 為了偵測濫用，可能保留最多 30 天，而且 Global Standard 部署可能在 Microsoft 任何區域處理；
    - Azure Speech 在阿拉伯聯合大公國處理。
- **理由**：
  - gpt-5-mini 是學生方案區域（UAE North）唯一可以部署、價格又低的新模型（D37）；
  - strict JSON schema 讓模型一定照格式回答，`lib/custom-practice/` 仍然會檢查每一筆內容；
  - 提示詞共用，換供應者時教學內容不變。
- **要改時**：
  - `lib/ai/azure-openai.ts`（模型設定、schema）；
  - `lib/ai/prompts.ts`（改了要調高 `PROMPT_VERSION`）；
  - `lib/ai/pricing.ts`；
  - `lib/ai/providers.ts`；
  - 隱私權政策（`messages/*.json` 的 `privacy`）。

## D41 錄製真實回應當 fixture；第一次實測（2026-11-06，e+ 6 PR 4）

- **決定**：
  - **錄製腳本** `npm run ai:record`（`scripts/ai-record.record.ts`）：
    - 用 Vitest 執行，這樣能重用正式的供應者程式和 `@/` 路徑別名，不用另外加套件；
    - 設定檔是 `vitest.record.config.mts`，不包含擋網路的 setup，平常的 `npm test` 也不會執行它；
    - 預設只印出要呼叫幾次和最壞情況的費用；設 `AI_RECORD_YES=1` 才真的呼叫；
    - 已經存在的 fixture 不會重錄，要設 `AI_RECORD_FORCE=1`；
    - 每次真的呼叫都會寫進 `api_calls`（`user_id` 是 null），`/admin/usage` 會把它算進學生額度。
  - **內容**：翻譯 1 句、講解 1 句、斷句 1 行（2 句）、生成約 40 字、聲音 1 句，存在 `tests/fixtures/ai/`。存的是請求內容和完整回應，不含 header，所以沒有金鑰。
  - **回放測試** `tests/azure-fixtures.test.ts`：
    - 把錄到的回應餵給供應者，確認結果能通過 App 的檢查（`cleanNotes`、`checkedSegments`、`checkGeneratedText`）；
    - 也比對現在送出的請求和錄製時一樣。改了提示詞或設定，這個測試就會失敗，提醒要重錄；重錄要經過 Joe 同意。
  - **試聽範例**：`npm run voices:samples -- --yes` 用 Azure 重新產生 8 個（每個 36～51 KB）。
- **2026-11-06 第一次實測**（Joe 預先核准的 US$0.05 額度內）：

  | 呼叫                | 輸入 token | 輸出 token | 字元 | 估算費用    |
  | ------------------- | ---------- | ---------- | ---- | ----------- |
  | 翻譯（gpt-5-mini）  | 150        | 24         | 10   | US$0.000086 |
  | 講解                | 358        | 66         | 22   | US$0.000221 |
  | 斷句                | 395        | 30         | 40   | US$0.000159 |
  | 生成                | 274        | 129        | 80   | US$0.000327 |
  | 聲音 1 句（F0）     | —          | —          | 17   | US$0        |
  | 試聽範例 8 個（F0） | —          | —          | 800  | US$0        |
  | **合計**            | 1,177      | 249        | 969  | US$0.000792 |
  - `reasoning_effort: "minimal"` 讓推理 token 是 0；
  - 最壞情況的預估是 US$0.0047，實際只用了六分之一；
  - 另外呼叫了一次免費的語音清單 API（D39），不算字元；
  - 還有 3 次在 PR 1 開發時，擋網路的設定還沒生效，對 Azure／Google 送出的請求。這些請求沒有附金鑰，直接被拒絕，不會計費。

- **要改時**：`scripts/ai-record.record.ts`、`tests/azure-fixtures.test.ts`、`tests/fixtures/ai/`。

## D42 自建練習的跟讀直接顯示中文、單字、文法（2026-11-06，e+ 7）

- **決定**（Joe 2026-11-05 指定）：
  - 自建練習的第 2～6 天跟讀時，每句的句子下方直接顯示中文翻譯、單字和文法講解；
  - 用聽寫每句答完後的同一個元件（`SentenceNotes`），換到下一句時跟著換；
  - 內建影片維持原樣：中文收在預設收合的「中文」裡。
- **理由**：
  - 自建練習只有聲音，畫面上沒有影片，講解可以補上「看得懂再念」的理解；
  - 第 1 天聽寫完成後講解就已經開放，跟讀時顯示不會洩漏答案；
  - 內建影片有畫面可以看，而且 Joe 只指定自建練習，所以不改變既有的練習方式。
- **要改時**：`components/ShadowingSession.tsx`（`video.audioUrls` 的判斷）、`components/SentenceNotes.tsx`。

## D43 每句各自保存講解；翻譯和講解的快取以一句為單位（2026-11-06，e+ 9a）

- **決定**：
  - **每句的講解**：`practice_sentences.notes`（jsonb），格式是 `{ vocab: [{word, pos, zh, example}], grammar: [{point, explanation, example}] }`，還沒產生時是 null。
    - 練習層級的 `practices.vocab`、`grammar` 保留，改成由每句合併而來（`joinNotes`，合併時去掉重複的單字或句型），所以講義、聽寫、跟讀、公開教材的讀取都不用改；
    - 舊的練習用 migration 把練習層級的講解拆到每句（只寫新欄位，舊資料不變）。2026-11-06 套用到正式站：1 個練習、8 句，單字 7 個、文法 2 個，拆分前後一致。
  - **產生講解**（`generatePracticeNotes`）：只處理還沒有講解的句子，每次最多一個模型呼叫（10 句）；每句一完成就存起來；全部完成後才合併到練習層級並設定 `notes_generated_at`。中斷後再按一次，只會做剩下的句子。
  - **句子層級的快取**（`ai_cache`）：
    - 翻譯的鍵是「供應者 id（含模型和提示詞版本）＋語言方向＋這一句的文字」；
    - 講解的鍵是「供應者 id ＋這一句的英文」；
    - 同一句出現在任何練習，都直接沿用，不再呼叫 API；一批裡只有沒快取的句子會送給模型；
    - 斷句仍然以整段文字為鍵，因為斷句本來就看整段；
    - 音檔原本就是「供應者＋聲音＋文字」一句一個檔（D22）。
- **理由**：
  - 編輯練習（e+ 9）時，只要重新產生改過的句子，沒改的句子連講解也保留；使用者手動修改的講解也不會被覆蓋；
  - 官方教材（e+ 10）會大量重複常見句子，以一句為單位快取，相同的句子在所有教材都只付一次費用；
  - 以前的快取是一整批（8 或 10 句）一個鍵，只要其中一句不同就全部重做。
- **要改時**：`lib/custom-practice/notes.ts`（`translateCached`、`annotateMissing`、`joinNotes`）、`app/materials/actions.ts`（`generatePracticeNotes`）、`supabase/migrations/20261106090000_sentence_notes.sql`。

## D44 自建練習的版本；進行中的一週固定使用開始時的版本（2026-11-06，e+ 9b）

- **決定**：
  - **版本號**：`practices.version` 從 1 開始，每次編輯（e+ 9c）加 1。練習本身的資料列一律是最新版本。
  - **快照**：要被取代的版本，如果可以練習（講解和音檔都完成了），就整份存進 `practice_versions`：標題、每句的英文、中文、音檔路徑、講解，以及練習層級的單字、文法。
    - 音檔以內容命名、從不刪除（D22），所以快照的音檔路徑一直有效；
    - 快照只能新增、不能修改：作者可以新增自己練習的快照；讀取的權限和練習本身一樣（作者自己，或公開的練習）。
  - **固定版本**：進度多了 `materialVersion`。
    - 一週的第一天開始時記下當時的版本（`pinVersion`）；
    - 新的一週（重新練一週）清掉，第一天開始時改用最新版本；
    - 版本功能上線前開始的一週，沒有這個欄位，但已經做過幾天，一律當作版本 1（那時所有練習都是版本 1）；
    - 內建影片沒有版本，不受影響。
  - **頁面怎麼顯示對的版本**：每天的練習頁和講義頁都包一層 `VersionGate`。
    - 它先讀進度，如果這一週固定的版本和頁面顯示的不同，就換成 `?v=<版本>` 重新載入，其他網址參數（例如 `?retry=1`）保留；
    - 確認之前不顯示練習，所以作答不會記到別的版本的句子上；
    - 伺服器收到 `?v=` 時讀取快照；快照不存在時顯示最新版本；網址已經是那個版本時不再跳轉，避免無限循環。
- **理由**：
  - 第 1 天和第 7 天的比較要用同一批句子才有意義，句數不同時也不會把作答記錯位置；
  - 「最新版本放在原本的表、舊版本存成不可變的快照」是常見的版本做法，讀最新版本不用多查一張表；
  - 版本放在網址參數，伺服器就能直接讀到對的版本，也不用改既有的連結：沒有帶 `?v=` 的連結會由 `VersionGate` 自動補上。
- **要改時**：`supabase/migrations/20261106120000_practice_versions.sql`、`lib/progress.ts`（`pinVersion`、`pinnedVersion`）、`lib/practice-material.ts`（`materialFromSnapshot`、`versionToShow`）、`auth/practice-material.ts`、`components/VersionGate.tsx`。

## D45 編輯自建練習（2026-11-06，e+ 9c）

- **決定**：
  - **頁面** `/materials/<id>/edit`：只有作者能打開，而且要在可以建立練習的情況下（目前只有管理員），因為儲存時可能會產生新的音檔和講解；其他人看到 404。入口是「我的教材」每個練習標題旁的「編輯」。
  - **可以改的內容**：
    - 標題、聲音；
    - 句子：新增、刪除、合併、拆分、上移、下移；
    - 每句的中文；
    - 每句的單字和文法：每句最多 2 個單字、1 個文法，和內建影片一樣。
  - Collection 和公開／私人沿用「我的教材」原本的即時控制，不放在編輯頁。
  - **只重新產生改過的部分**：
    - 英文沒改（以完全相同的文字比對，順序可以變）的句子，保留音檔（聲音沒換時）和講解；
    - 英文改過的句子，重新產生音檔；中文和講解也重新產生，除非作者在同一次編輯裡自己改了；
    - 換聲音時，每一句都重新產生音檔，但相同文字加相同聲音的檔案仍然沿用（D22）；
    - 需要的中文在儲存時翻譯；講解和音檔在儲存後用原本「繼續產生」的流程補上，進度條和建立時相同。翻譯和講解都有句子層級的快取（D43）。
  - **儲存**：資料庫函式 `save_practice_edit` 在一個交易裡完成：
    1. 舊版本如果可以練習，存成快照（D44）；
    2. 換掉所有句子；
    3. 版本號加 1。
    - 函式用呼叫者的權限執行，所以只有作者能儲存；
    - 編輯頁會帶著打開時的版本號，如果中間有人存過，就回傳「版本衝突」，請使用者重新整理，不會悄悄覆蓋。
  - **權限修正**：`practice_versions` 原本的讀取規則用到了 `practices.user_id`，但匿名使用者沒有這個欄位的讀取權限，所以讀不到公開練習的快照。已拆成匿名和登入兩條規則（migration `20261106160000`）。
- **理由**：
  - 用文字比對決定沿用什麼，不用追蹤每一列的身分：合併、拆分、重新排序後，只要英文相同就能沿用，最簡單也最不會出錯；
  - 用一個交易加上版本號檢查（樂觀鎖定）是常見的避免覆蓋別人修改的做法；
  - 儲存前就翻譯，講解和音檔沿用原本可以中斷、再繼續的流程，用量都經過每日上限（D38）。
- **要改時**：`lib/custom-practice/edit.ts`、`app/materials/edit-actions.ts`、`components/EditPracticeForm.tsx`、`app/materials/[id]/edit/page.tsx`、`supabase/migrations/20261106150000_save_practice_edit.sql`。

## D46 官方教材；Supabase 免費方案可以放多少音檔（2026-11-06，e+ 10）

- **決定**：
  - **官方教材**：`practices.official`。管理員在「我的教材」按「設為官方教材」，那份教材就會：
    - 自動改成公開（資料庫限制：官方教材一定公開）；
    - 出現在首頁「推薦練習」最上面的「ListenLoop 官方教材」，依建立順序排列，像一門課；還沒有官方教材時不顯示這一區；
    - 所有人都能練：和公開練習一樣直接讀取同一份句子、音檔和講解，不會替每個人重新產生，也不花 API 費用。
  - **誰能標記**：只有伺服器用秘密金鑰的管理員動作（`setOfficial`），而且只能標記自己建立、沒有被下架的練習。資料庫觸發器 `guard_official` 拒絕來自使用者連線的修改，即使使用者可以修改自己的練習，也不能把它設成官方教材。
  - **永久保存、只呼叫一次 API**：每一句的文字、中文、講解存在 `practice_sentences`（D43），音檔存在 Supabase Storage，以「聲音＋句子文字」命名（D22）；翻譯和講解的快取以「模型與提示詞版本＋句子文字」為鍵（D43）。相同的句子出現在任何教材，都直接沿用。
  - 卡片和「公開教材」頁共用 `PracticeCard`。
- **儲存空間估算**（2026-11-06 查 supabase.com/pricing：Free 方案檔案儲存 1 GB、上傳單檔上限 50 MB、未快取傳輸 5 GB／月、快取傳輸 5 GB／月、資料庫 500 MB）：
  - **音檔大小**：Azure 的 MP3 是 48 kbps 固定位元率，每秒 6 KB，每分鐘約 360 KB。實測：正式站目前 8 個音檔共 124,224 bytes；試聽範例 101 字元約 40 KB、約 6.6 秒。
  - **可以放多少**：1 GB ÷ 360 KB ≈ **2,900 分鐘，約 48 小時的音檔**。以一份 3 分鐘的教材計算，約 **970 份**；相同的句子和聲音只存一次，實際會更多。
  - **字數換算**：英文大約每分鐘 130 字（D36）、每字約 6 字元，1 分鐘的音檔約 780 字元。Azure F0 每月 50 萬字元，約可產生 640 分鐘，所以每月新增的量會先受 F0 限制，不是儲存空間。
  - **流量**：學生練習時從 Storage 下載音檔。一份 3 分鐘的教材約 1.1 MB；一週的 7 天循環，即使每天都重新下載，約 8 MB。每月 5 GB 未快取傳輸約可支援 **600 人週**；瀏覽器和 CDN 有快取時會更多。之後使用者多了，先注意的是流量，不是儲存空間。
  - **資料庫**：每句的文字、中文和講解約 1 KB，500 MB 足夠數十萬句。
- **要改時**：`supabase/migrations/20261106180000_official_practices.sql`、`app/materials/organize-actions.ts`（`setOfficial`）、`auth/public-practices.ts`（`listOfficialPractices`）、`components/OfficialPractices.tsx`、`components/OfficialToggle.tsx`。用量變大時，重新查 Supabase 的價格頁再估算一次。

## D47 建立練習的設定診斷；環境變數寬鬆讀取（2026-11-06）

- **問題**：Joe 在 Vercel 設好六個 `AZURE_*` 變數後，正式站仍顯示「還沒有接上聲音和翻譯服務」，`/materials/new` 回 404。程式只回傳「可以／不可以」，看不出是哪一項沒通過。
- **判定條件**（全部成立才能建立練習，`auth/creator.ts` 的 `canCreatePractices`、`getCreator`）：
  1. 登入的 email 在 `ADMIN_EMAILS` 裡；
  2. 有 Supabase 設定和 `SUPABASE_SERVICE_ROLE_KEY`（記錄用量、存音檔要用）；
  3. 正式站沒有設 `AI_PROVIDERS=fake`；
  4. `AI_LANGUAGE_PROVIDER`、`AI_SPEECH_PROVIDER` 沒設定（預設 azure）或是 azure、google；
  5. Azure 文字：端點、金鑰、部署名稱、模型都有設定；端點是 https 的 Azure 網址；模型在價格表裡（D38）；
  6. Azure 聲音：金鑰、區域都有設定，區域是代碼格式。
- **決定**：
  - `/admin/usage` 最上面加「設定診斷」，逐項列出是否成立，**不顯示任何值**。沒有秘密金鑰時，這一頁仍然打得開，只顯示診斷（原本會 404，看不出原因）。
  - 診斷和真正的判定共用同一份程式（`lib/ai/providers.ts` 的 `languageSetup`、`speechSetup`），不會出現「診斷通過、實際不通過」。
  - 讀取變數時容忍常見的貼上錯誤：前後的引號、區域寫成「UAE North」、大小寫不同；端點也接受 Foundry 的 `*.services.ai.azure.com`。
  - 頁首的「建立練習」也改成檢查秘密金鑰，和 `getCreator` 一致，不會出現按了卻 404 的按鈕。
- **理由**：設定錯誤是部署後最常見的問題；只顯示「成立／不成立」就能定位，又不會把金鑰露在畫面上（業界的 health check 也是這樣做）。
- **要改時**：`lib/ai/providers.ts`、`auth/creator.ts`（`diagnoseCreator`）、`app/admin/usage/page.tsx`、翻譯檔 `adminUsage.diagnosis`。

## D48 頁首導覽：我的教材、建立練習；拿掉筆記本（2026-11-06）

- **決定**：
  - 登入後，頁首左側顯示「我的教材」（原本只有能建立練習的管理員看得到，而且接不上服務時連管理員也看不到）。
  - 一般使用者打開「我的教材」，會看到「建立練習還沒開放」的說明；管理員看到原本的完整頁面。未登入仍然回 404。
  - 管理員在可以建立練習時，頁首右側最前面多一個 primary 小按鈕「＋ 建立練習」。
  - 筆記本之後會刪除（Joe 2026-11-06），先拿掉頁首的「筆記本」；`/notebooks` 頁面暫時保留。
  - 手機：頁首左右兩組都會換行，所以兩個入口在窄螢幕也直接看得到，不藏進選單。
- **理由**：常用的入口放在頁首，不藏在帳號選單裡；建立練習是管理員最主要的動作，用 primary 按鈕突顯。
- **要改時**：`components/SiteHeader.tsx`、`app/layout.tsx`、`app/materials/page.tsx`。

## D49 斷句一定退回規則；失敗紀錄加上 HTTP 狀態碼；免費的「測試連線」（2026-11-07）

- **問題**：正式站貼上兩段英文新聞（349 字元，含彎引號 ’ 和空行）按「斷句並翻譯」，顯示「找不到可以練習的句子」，`/admin/usage` 也沒有新的呼叫紀錄。
- **原因**：
  - 文字本身沒有問題：規則斷句和 AI 斷句的檢查都能正確切成 2 句（已加進測試，`tests/fixtures/text/news-two-paragraphs.txt`）。
  - 斷句失敗時，伺服器本來就會退回規則斷句；但**伺服器動作本身拋出錯誤時**，表單（`components/practice-generation.ts`）把任何錯誤都當成「找不到句子」。
  - 會拋出錯誤、又不留下呼叫紀錄的情況有兩種：
    - 網站重新部署後，還開著的舊頁面呼叫舊的伺服器動作，Next.js 會回「找不到這個 Server Action」。Joe 剛重設金鑰、重新部署後測試，最符合這種情況；
    - 函式超過 Vercel 的執行時間被中止，呼叫來不及記錄。
- **決定**：
  - **斷句一定有結果**：
    - 伺服器端的 AI 斷句失敗、拋出例外、超過 20 秒（`SEGMENT_WAIT_MS`），或用量紀錄、快取連不上時，都改用規則斷句；
    - 連伺服器都連不上時，瀏覽器直接用同一套規則斷句（`splitSentences`），再繼續翻譯。
  - **翻譯連不上伺服器**時，改顯示「連不上伺服器，可能是網站剛更新。請先複製你的文字，重新整理頁面後再試」，不再說「找不到句子」。
  - **時間上限**：呼叫 AI 的頁面設 `maxDuration = 60`（Hobby 的上限）。供應者的請求在 45 秒時放棄，所以慢的呼叫會記成 `timeout`，函式不會先被中止。
  - **失敗紀錄**：`api_calls` 新增 `http_status`、`error_code`（migration `20261107090000`，只新增欄位）。
    - 記的是供應者回應的狀態碼和簡短的錯誤代碼，例如 `HTTP 404 DeploymentNotFound`，或 `timeout`、`network`、`exception`；
    - 不記金鑰、送出的文字，也不記錯誤訊息全文；
    - `/admin/usage` 顯示成「失敗（config；HTTP 401）」。
  - **測試連線（免費）**：`/admin/usage` 的「設定診斷」下方有按鈕，每個供應者用不計費的請求檢查：
    - Azure OpenAI：送出空的對話。部署存在時，Azure 在模型執行前就拒絕，回 400，不計 token。2026-11-07 用本機金鑰實測 1 次：HTTP 400 `empty_array`，沒有 usage，費用 US$0；
    - Azure Speech：讀取聲音清單（免費）；
    - Gemini：讀取模型資料；Google TTS：讀取聲音清單。
    - 結果顯示狀態碼、錯誤代碼，以及要檢查哪個設定（例如 401 是金鑰錯誤，`DeploymentNotFound` 是部署名稱錯誤）。測試連線不計入每日上限，也不寫進呼叫紀錄。
    - 還沒驗證：部署名稱錯誤時，Azure 是先回 404，還是先檢查請求內容、回 400。驗證需要再呼叫一次，所以留給 Joe 在正式站操作時確認。
- **理由**：
  - 斷句是規則就能做的事，AI 只是讓結果更好，所以 AI 或連線出問題時不應該讓使用者卡住；
  - 錯誤訊息要說出真正的原因。把「連線失敗」顯示成「找不到句子」，會讓人去檢查文字，而不是重新整理；
  - 用狀態碼和錯誤代碼定位設定問題，又不暴露秘密資訊，是常見的做法。
- **要改時**：
  - `lib/custom-practice/notes.ts`（`segmentCached`、`SEGMENT_WAIT_MS`）、`components/practice-generation.ts`；
  - `lib/ai/http.ts`（`PROVIDER_TIMEOUT_MS`、`probeProvider`）、各供應者的 `checkConnection`；
  - `app/admin/usage/actions.ts`、`components/ConnectionTest.tsx`、`app/admin/usage/page.tsx`。

## D50 帳號資料：角色、使用者編號、停用（2026-11-07，P0-1）

- **決定**：
  - 新增 `profiles` 資料表：`number`（使用者編號）、`role`（admin／user）、`status`（active／disabled）、`created_at`、`last_seen_at`。不存 email。
  - **使用者編號**：新帳號註冊時由資料庫觸發器建立資料，編號自動遞增；後台顯示成「使用者 001」（至少三位數）。既有帳號用 `scripts/backfill-profiles.mts` 補上：ADMIN_EMAILS 的第一個帳號（Joe 的管理員帳號）是 000，其他人依註冊順序從 001 開始，所以 Joe 的一般帳號是「使用者 001」。腳本讀取 ADMIN_EMAILS，所以 email 不會進到 repo。
  - **角色**：ADMIN_EMAILS 裡的帳號每次登入（伺服器讀取工作階段時）自動成為 admin，並寫回 `profiles`；其他管理員之後在後台指定。程式只看 `user.role`，不再直接比對 email。
  - **停用**：`status = disabled` 時，伺服器把這個帳號當成未登入；後台停用時同時在 Supabase Auth 封鎖（ban），所以無法登入或延長工作階段。被封鎖的人登入時，會看到「這個帳號已被停用」。已發出的存取權杖最長 1 小時內失效，期間伺服器頁面已經不認得這個帳號。
  - **權限**：使用者只能讀自己的資料；只有伺服器（service_role）能寫。另外新增 `is_admin()` 函式，供其他資料表的 RLS 判斷管理員。
- **理由**：角色存在資料庫，才能在後台指定管理員；編號讓後台不用顯示 email，降低個資外洩的風險。
- **要改時**：`supabase/migrations/20261107120000_profiles.sql`、`auth/session.ts`、`lib/accounts.ts`、`scripts/backfill-profiles.mts`。

## D51 環境變數耐錯讀取（全形轉半形）；建立與編輯練習改用聲音選單（2026-11-07，P0-2）

- **環境變數**：所有 AI 相關變數讀取時，先做 Unicode NFKC 正規化（全形英數字與全形空白轉成半形），再去掉前後空白和前後成對的引號。`AZURE_OPENAI_MODEL`、`AZURE_OPENAI_DEPLOYMENT`、`AZURE_SPEECH_REGION` 另外轉小寫；區域再去掉中間的空白（「UAE North」→ `uaenorth`）。
  - 部署名稱轉小寫的前提：部署名稱用小寫建立（Joe 的是 `gpt-5-mini`）。如果之後建立了含大寫字母的部署名稱，要改 `lib/ai/providers.ts` 的 `readEnvName`。
- **聲音選擇**：Joe 確認 `VoiceMenu`（e+ 3b），建立與編輯練習都改用它，刪除舊的 `VoicePicker` 卡片元件和測試。`voiceSampleUrl` 移到 `components/VoiceMenu.tsx`。
- **要改時**：`lib/ai/providers.ts`、`components/VoiceMenu.tsx`、`components/CreatePracticeForm.tsx`、`components/EditPracticeForm.tsx`。

## D52 跟讀：100% 彩帶；連續 5 次低於 50% 的排查對話框與問題句子紀錄（2026-11-07，P0-2）

- **彩帶**：聽寫和跟讀共用 `PerfectCelebration`。一句 100% 時播放彩帶；系統設定減少動態效果時，改顯示靜態的「完美！」。文字移到共用的翻譯群組 `celebration.perfect`。
- **排查對話框**：同一句連續 5 次涵蓋率都低於 50%（`lib/shadowing-trouble.ts` 的 `TROUBLE_ATTEMPTS`、`TROUBLE_COVERAGE`）時，跳出對話框。
  - 對話框說明可能是辨識的問題，不一定是念得不好，並列出 4 個建議：麥克風、安靜的環境、使用電腦版 Chrome、聽完整句再念。
  - 「再試一次」：關閉對話框，重新計算 5 次。
  - 「跳過這句並回報」：這句記為完成（進度裡加 `skipped: true`），不影響當天任務。逐句紀錄顯示「已跳過」，平均涵蓋率仍然用最好的那次。
  - 一次涵蓋率達 50% 以上、或換到別句，都會重新計算。
- **問題句子紀錄**：兩個選項都會送出紀錄到 `shadowing_issues`。
  - 內容：練習 id 與版本、句子位置、5 次的涵蓋率與辨識文字（每次最多 300 字）、瀏覽器與作業系統名稱（例如「Chrome 140 · macOS」，只取主版本）、是否跳過；登入時另外記使用者 id。
  - 只存文字，不存錄音；未登入也可以回報；送出失敗不會打斷練習。
  - 只有伺服器（service_role）寫入，只有管理員可以讀取（`is_admin()`）。刪除帳號時一併刪除。
  - 管理員後台的「容易出錯的句子」會用這份紀錄。
- **對話框元件**：`components/Dialog.tsx`，用原生的 `<dialog>` 加 `showModal()`：焦點留在對話框裡、背景不能操作，按 Escape 等於「再試一次」。
- **要改時**：`lib/shadowing-trouble.ts`、`components/ShadowingSession.tsx`、`app/videos/shadowing-actions.ts`、`components/PerfectCelebration.tsx`、`components/Dialog.tsx`、`supabase/migrations/20261107140000_shadowing_issues.sql`。

## D53 移除筆記本（2026-11-07，P0-2）

- **決定**：依 Joe 的決定，刪除筆記本的頁面（`/notebooks`）、Server Actions、元件、測試、翻譯文字，以及資料表 `notebooks`、`notebook_entries`（migration `20261107150000_drop_notebooks.sql`）。
- **刪除前的確認**：
  - 沒有其他資料表參照這兩張表：`notebook_entries` 只參照 `notebooks`，其他資料表沒有外鍵指向它們；
  - 程式中只有筆記本自己的頁面與動作使用它們；
  - 正式資料庫當時有 1 本筆記本、1 筆內容，是測試資料。
- **理由**：產品聚焦在 7 天循環；單字與文法已經在講義裡。之後如果要做「收藏句子」，重新設計，不沿用舊的表。
- **要改時**：已經沒有相關程式。舊網址 `/notebooks` 現在是 404（原本只有管理員看得到）。

## D54 方案限制的集中設定（2026-11-07，roadmap f）

- **決定**：`lib/plans.ts` 集中設定每個方案能做什麼，程式一律透過 `can(plan, action)` 判斷。
  - 方案：`free`（一般使用者與未登入）、`admin`。`planFor(user)` 依角色決定。
  - 限制項目：
    - `createPractices`：能不能建立練習。目前只有 admin 可以，和 D5 一樣；
    - `activePractices`：同時進行中的練習數；
    - `practicesPerMonth`：每月建立數（台灣時間的月份）；
    - `charsPerPractice`：每份練習的字數。
  - 數字型的限制目前全部是 `null`（不限制）。服務本身的技術上限（`PRACTICE_LIMITS`：1 萬字元、300 句）仍然有效，兩者取較嚴格的。
  - 只有方案真的有限制時（`needsCount`），才會去計算目前的數量，所以現在不會多查資料庫。
  - 套用位置：
    - 頁首的「建立練習」和 `getCreator`；
    - 斷句前的字數檢查；
    - 建立練習時的每月數量；
    - 第 1 天聽寫開始一份新練習時的同時練習數（瀏覽器端，透過 `PlanProvider` 取得方案）。
  - 超過限制的訊息統一放在翻譯檔的 `plans.limits`。
- **之後收費**：新增方案 id（例如 `pro`），在 `PLANS` 填數字，`planFor` 改成讀取使用者的訂閱；功能程式不用改。
- **要改時**：`lib/plans.ts`、`components/PlanProvider.tsx`、`app/materials/actions.ts`、`auth/creator.ts`、`components/DictationSession.tsx`。

## D55 使用者操作紀錄（2026-11-07，P0-3）

- **記錄的事件**（`events` 資料表，`lib/events.ts`）：
  - 登入、開始練習、完成某一天（附分數：聽寫正確率或跟讀平均涵蓋率）、重練；
  - 建立、編輯、刪除練習，設為公開；
  - 檢舉（附原因代碼）；
  - 跳過句子、語音辨識失敗（附錯誤代碼，同一句同一種錯誤只記一次）；
  - 刪除帳號：帳號的紀錄會跟著刪除，這筆只留使用者編號（例如 `user-001`）。
- **只記必要欄位**：使用者 id、練習 id、第幾天、分數、簡短代碼。不記 email、練習的文字內容、辨識出的文字（辨識文字只在使用者主動回報問題句子時，存在 `shadowing_issues`，見 D52），也不記錄音。
- **誰能寫、誰能讀**：只有伺服器（service_role）能寫；瀏覽器透過 Server Action `recordEvent` 回報，而且只接受 5 種類型（開始練習、完成一天、重練、跳過句子、辨識失敗），並檢查每個欄位。RLS 只讓管理員（`is_admin()`）讀取。
- **未登入的練習不記錄**：只存在使用者自己的裝置上。
- **保留期限**：操作紀錄 180 天；問題句子紀錄 365 天（API 呼叫紀錄不刪，見 D56）。由資料庫函式 `prune_logs()` 刪除，管理員打開後台總覽時執行（不需要排程服務）。
- **最後活動**：每次記錄事件時，一併更新 `profiles.last_seen_at`，供後台的使用者清單使用。
- **要改時**：`lib/events.ts`、`auth/events.ts`、`app/events/actions.ts`、`supabase/migrations/20261107160000_events.sql`，以及各個記錄的地方（搜尋 `logEvent`、`logClientEvent`）。

## D56 管理員後台 `/admin`（2026-11-07，P0）

- **入口**：頁首「我的教材」右邊的「後台」，只有管理員看得到，樣式同其他頁首連結；手機上頁首會換行，所以仍然看得到。`/admin` 以下的每一頁，非管理員都回 404（`app/admin/layout.tsx`）。
- **導覽**：每頁上方是一排區塊連結（`AdminNav`）。手機上不換行，改成左右捲動；目前所在的區塊用 accent 底線和 `aria-current="page"` 標示。還沒做好的區塊（教材、意見回饋、錯誤紀錄）在完成後才加進導覽。
- **總覽**：
  - 使用者：總數、今日活躍、本週活躍、新註冊；
  - 練習：新增練習、完成天數；
  - 費用與額度：本月 API 費用、Azure 學生額度剩餘、本月 Azure 聲音字元；
  - Supabase：資料庫和檔案用量，與免費方案上限的比例。
  - 「本週」是最近 7 個台灣日（含今天），不是週一開始，數字比較穩定。數字來自資料庫函式 `admin_overview`（只有 service_role 能呼叫），活躍人數用操作紀錄計算。打開總覽時，也會執行 `prune_logs()`（D55）。
- **使用者**：
  - 清單：使用者編號、註冊日期、最後活動、練習數、本月用量、角色、狀態（`admin_users`），不顯示 email；
  - 點編號進入個人頁：可以設為管理員或改回一般使用者、停用或恢復（停用要按兩次確認），下方是這個帳號最近的操作紀錄。
  - 限制：不能變更自己的帳號，避免把自己鎖在外面；ADMIN_EMAILS 裡的帳號不能降級或停用，因為登入時會自動恢復成管理員。
- **操作紀錄**：可以依使用者編號、事件類型和日期（台灣時間）篩選。篩選表單用 GET，所以篩選結果的網址可以分享給其他管理員。最多顯示 100 筆。
- **容易出錯的句子**：把問題句子的回報（D52）依句子分組，排序依序看跳過次數多、平均涵蓋率低、回報次數多。自建練習連到編輯頁，內建影片連到影片頁。
- **管理稽核**：新增 `admin_audit` 資料表，記錄誰、什麼時候、對什麼、改了什麼（改前 → 改後），保留 2 年。目前記錄的動作：變更使用者角色或狀態、下架、恢復、駁回檢舉、設為官方教材。
- **保留期限修正**：API 呼叫紀錄不再自動刪除，因為它是 Azure 學生額度剩餘的計算基礎（D38）。D55 原本寫 365 天，已改成不刪除。
- **要改時**：`app/admin/`、`lib/admin-dashboard.ts`、`lib/hard-sentences.ts`、`auth/audit.ts`、`components/AdminNav.tsx`、`components/UserControls.tsx`、`components/EventTable.tsx`、`supabase/migrations/20261107180000_admin_dashboard.sql`。

## D57 教材分類、AI 建立教材、雙聲音對話（2026-11-07，P0）

- **分類集中設定**：`lib/categories.ts`。
  - 結構：類別 ＞ 子情境；考試類是考試 ＞ 題型，另外加上目標程度。依 Joe 列的 11 類、子情境、4 種考試與目標程度建立。
  - 使用的地方：AI 生成練習、後台教材管理的篩選、推薦練習的篩選。
  - 每個子情境有給模型的描述，以及預設的形式（對話或獨白），使用者可以改。
  - 名稱放在翻譯檔的 `categories` 群組；測試會檢查每個 id 在兩種語言都有名稱，而且子情境 id 不重複。
  - 托福沒有指定目標程度，自訂為「約 80 分」「約 100 分」。
- **考試類只模仿題型風格與難度**：給模型的描述都寫明「內容原創，不是真實考題」；介面寫「托福風格」，旁邊有一行說明「與考試主辦單位無關」。
- **新聞類**：要求「原創新聞風格，不寫真實事件」；共用的生成指示原本就禁止真實人名、品牌和時事（D36）。
- **AI 生成的選項**：類別、子情境（考試類改成考試、題型）、程度（考試類改成目標程度）、長度、形式、口音。
  - 長度沿用片段長度區間：1–2、2–3、3–4、4–5 分鐘，以區間中點 × 每分鐘 130 字估算字數。
  - 口音同時決定拼字與用語（例如英式拼字），並把預覽步驟的聲音預設成該口音的女聲，B 是同口音的男聲。
  - 選項都併入原本傳給模型的欄位，生成指示和輸出格式不變，所以已錄製的 fixture 仍然有效，不需要重新呼叫。
- **教材的分類資料**：`practices` 新增 `category`、`scenario`、`level`、`exam`、`exam_target`。AI 生成的練習建立時自動填入，伺服器會對照分類設定再檢查一次；上傳的文字沒有分類，之後由管理員在後台設定。
- **官方教材草稿**：新增 `published`。官方教材可以先存成草稿：未發布、保持私人，管理員在後台發布後才公開。資料庫限制從「官方教材一定公開」改成「已發布的官方教材一定公開」。`published` 和推薦排序 `sort_order` 只有伺服器能改，和 `official` 一樣。
- **雙聲音對話**：
  - 文字框裡每行開頭的「A:」「B:」（全形冒號也可以）代表說話者，不會被念出來。AI 生成的對話會自動加上標記，一行一個人輪流說。
  - 斷句時每句記下說話者（`practice_sentences.speaker`）；B 的句子用第二個聲音（`practices.voice_b`）產生音檔。
  - 預覽和編輯時，每句左邊有 A／B 按鈕可以切換，下方有 A、B 兩個聲音選單。新增的句子預設給另一個人。
  - 編輯時，只有「實際使用的聲音」改變的句子才重新產生音檔，例如只改了 B 的聲音，就只重做 B 的句子。
  - 儲存編輯的資料庫函式改成一併儲存說話者和第二個聲音；版本快照也包含說話者。
  - 只有一個說話者的文字（沒有 B），維持原本的單一聲音。
- **要改時**：
  - 分類與生成：`lib/categories.ts`、`lib/custom-practice/generation.ts`、`components/GenerateTextPanel.tsx`；
  - 對話：`lib/custom-practice/speakers.ts`、`components/SpeakerToggle.tsx`、`components/CreatePracticeForm.tsx`、`components/EditPracticeForm.tsx`、`app/materials/actions.ts`、`lib/custom-practice/edit.ts`；
  - Migration：`20261107200000_practice_categories.sql`、`20261107210000_dialogue_speakers.sql`。

## D58 後台教材管理；推薦練習的篩選與順序（2026-11-07，P0）

- **`/admin/materials`**：列出官方教材、公開教材，以及被下架的教材，可以依類別、考試、狀態篩選（草稿、已發布、一般公開）。每份教材顯示：
  - 作者編號、建立日期、句數、分類；
  - 公開或私人，或下架原因；還沒完成時顯示音檔進度。
- **官方教材的三種狀態**：不是官方、草稿（私人）、已發布（公開，出現在推薦練習）。
  - 只有管理員建立的教材可以設為官方，避免學習者之後修改所有人看到的內容；
  - 講解和全部音檔都完成後才能發布；
  - 取消官方不改變公開狀態。
  - 在「我的教材」按「設為官方教材」，現在會先存成草稿，需要到後台發布（原本會直接公開）。
- **推薦順序**：已發布的官方教材可以在後台用 ↑／↓ 調整。每次調整後，`sort_order` 會重新編號成 1、2、3……；推薦練習依這個順序顯示，沒有設定順序的排在最後，依建立時間。
- **分類**：可以為任何教材設定或清除類別、情境、程度（考試類是目標程度），伺服器會對照分類設定檢查。
- **下架與恢復**：沿用檢舉審查的動作（D31），在這裡不顯示「駁回檢舉」。
- **編輯**：如果是自己建立的教材，可以直接進入編輯頁。編輯頁限作者本人，這是 D45 的權限設計。
- **每一項變更都記錄在管理稽核**。
- **推薦練習的篩選**：首頁「ListenLoop 官方教材」上方有類別篩選；選「考試聽力」後，可以再選考試。只顯示有教材的類別；只有一個類別時不顯示篩選。卡片上方顯示類別和考試名稱。
- **要改時**：`app/admin/materials/`、`lib/material-admin.ts`、`components/MaterialControls.tsx`、`components/OfficialLibrary.tsx`、`auth/public-practices.ts`。

## D59 官方範例教材草稿（2026-11-07，P0）

- **怎麼做的**：`npm run official:drafts`（`scripts/official-drafts.record.ts`）用真的供應者，依序替每份教材：AI 寫文字 → 斷句（對話保留 A／B）→ 翻譯 → 講解 → 存成官方草稿（私人、未發布）→ 產生音檔。擁有者是第一位管理員（使用者 000）。
- **清單**：
  - 類別 1～10 各 1 份，選每類最常用的子情境：咖啡店、機場報到、開銀行帳戶、週末計畫、教授 office hours、論文摘要、求職面試、科技新聞、心理學、個人成長故事；
  - 考試類 4 份：托福學術講座（生物）、雅思 Part 1 對話（Band 6.5）、多益職場對話（750 分）、全民英檢中級對話。
  - 長度 1–2 或 2–3 分鐘；對話 9 份、獨白 5 份；程度從初級到高級；口音輪流使用美、英、澳、印。對話的 A 是女聲、B 是同口音的男聲。
  - 主題貼近台灣學生與留學生，不用真實人名、品牌或可識別的個人資料（共用的生成指示原本就禁止，D36）。
- **省錢規則**：
  - 預設只印出計畫和預估，要加 `OFFICIAL_YES=1` 才會真的呼叫；
  - 每次語言模型呼叫前，先預留最壞情況的費用；如果「已花費＋預留」會超過 US$1.00，就拒絕這次呼叫並停止；
  - 每次呼叫都寫進 `api_calls`，可以在 `/admin/usage` 核對；
  - 已經存在的草稿（同一位擁有者、同一個子情境）會跳過，所以中途停止後可以直接重跑。
- **放寬聲音上限**：只有建立官方教材時，使用 `OFFICIAL_DAILY_LIMITS`，聲音每日上限從 16,000 字元放寬到 120,000 字元。仍遠低於 Azure F0 每月 50 萬免費字元。一般建立練習的上限不變。
- **F0 忙碌**：遇到每分鐘的請求上限時，等 30 秒再繼續，最多等 20 次。仍然沒完成的音檔，可以在「我的教材」繼續產生。
- **實際結果**（2026-11-07）：
  - 14 份都完成，都是官方草稿（私人、未發布），每一句都有音檔；
  - 長度約 1.1～3.0 分鐘，共 384 句；
  - 語言模型 121 次呼叫：輸入 50,410 token、輸出 44,976 token，**US$0.1026**；
  - Azure Speech 367 次、26,677 字元，F0 免費。
  - 沒有碰到 US$1.00 的上限。
- **要改時**：`scripts/official-drafts.record.ts` 的 `SPECS`、`lib/usage.ts` 的 `OFFICIAL_DAILY_LIMITS`。

## D60 服務條款、隱私權政策更新、帳號資料下載與刪除、年齡提示、意見回饋（2026-11-07，P1）

- **服務條款 `/terms`**（中英文）：
  - 服務內容（含 AI 產生的內容可能有錯）、帳號、使用規範、使用者上傳內容的責任與授權、侵權檢舉與下架流程、考試風格教材聲明、免責聲明、服務變更、條款變更、準據法（中華民國法律）。
  - 和隱私權政策共用 `LegalPage` 版面，文字放在翻譯檔。
  - 這是依常見做法寫的範本，不是法律意見；正式收費或擴大經營前，建議請律師看過。
- **隱私權政策**（2026-11-07 版）新增或修改：
  - 新增收集項目：帳號資料（編號、角色、狀態）、操作紀錄、問題句子回報（含辨識文字）、意見回饋；
  - 保存期限：操作紀錄 180 天、問題句子 365 天；API 用量為了核算費用而保存，刪除帳號時移除與你的關聯；
  - 使用者權利：下載資料、刪除帳號，聯絡方式改成「意見回饋」頁；
  - 新增「未成年人」一節。
  - Azure 資料處理的說明沿用 D40（不用來訓練，Azure OpenAI 最多保留 30 天用於偵測濫用）。
- **聯絡方式**：從 GitHub Issues 改成站內的「意見回饋」，因為 GitHub 留言是公開的，不適合處理個人資料問題。Google Play 另外需要一個公開的聯絡 email，要 Joe 提供（見 roadmap「需要 Joe 操作的事」）。
- **帳號頁**：
  - 下載我的資料：`/account/export` 下載 JSON 檔，包含帳號、進度、自建練習（含句子與版本）、Collection、操作紀錄、回報、回饋、送出的檢舉、API 用量。只依登入的工作階段決定是誰的資料。
  - 刪除帳號：資料庫中的帳號、進度、練習、紀錄、回報、回饋都隨帳號刪除（外鍵 on delete cascade）。另外會刪除只有這個帳號的練習使用的音檔；其他練習共用的音檔保留（音檔以內容命名、共用，D22）。確認畫面列出會刪除的項目。
- **年齡與用途（評估結論）**：
  - Google 帳戶：台灣不在 Google 的特別年齡清單中，適用預設的 13 歲下限（support.google.com/accounts/answer/1350409）。
  - Azure OpenAI：Microsoft 沒有對終端使用者公告明確的年齡下限。行為準則禁止以可能剝削或操控未成年人的方式互動；OpenAI 自己的條款則要求 13 歲以上，未滿 18 歲需要家長同意。
  - ListenLoop 的 AI 功能目前只開放給管理員，一般使用者不會把文字送到 AI 服務。學生只聽和念 AI 產生的內容，以及使用瀏覽器內建的語音辨識。
  - 決定：
    - 每台裝置第一次使用時，在頁首下方顯示一次提示：「使用即表示同意服務條款與隱私權政策；未滿 18 歲請在家長或法定代理人同意下使用」，按「知道了」後不再顯示；
    - 條款與隱私權政策都寫明：未滿 13 歲請勿自行建立帳號；
    - Google Play 的目標年齡建議選 13 歲以上，不加入「家庭」計畫，以避免兒童政策的額外要求。
  - 之後如果要開放一般使用者使用 AI 建立練習，需要重新評估：例如限制 18 歲以上，或加入家長同意流程。
- **意見回饋 `/feedback`**：類型（問題、建議、內容、帳號、其他）＋內容（最多 2000 字）。存到 `feedback` 資料表：登入時附上帳號，登入的帳號每天最多 10 則。管理員在「後台 → 意見回饋」查看，並標示已處理（記入稽核）。
- **頁尾**：服務條款、隱私權政策、素材出處、意見回饋。
- **要改時**：翻譯檔的 `terms`、`privacy`、`usageNotice`、`feedback`；`components/LegalPage.tsx`、`components/UsageNotice.tsx`、`auth/account-data.ts`、`app/account/`、`app/feedback/`、`app/admin/feedback/`。

## D61 使用者體驗與上線品質：新手引導、錯誤頁、無障礙、SEO（2026-11-07，P1）

- **新手引導**：
  - 首頁上方的卡片「第一次來？這樣練」：用三步驟說明 7 天循環（第 1 天聽寫、第 2～6 天跟讀、第 7 天再聽寫），附上「從推薦的第一份開始」和「略過」。
  - 推薦起點是推薦練習中排第一的官方教材；還沒有官方教材時，用內建影片庫的第一支初級影片。
  - 開始任何練習後就不再顯示，按「略過」也會在這台裝置上記住。只在瀏覽器檢查完後才顯示，所以已經在練的人不會看到它閃一下。
- **錯誤與 404**：
  - 自訂 404：中英文，「回首頁」和「回報問題」；
  - 頁面錯誤：說明「進度不受影響」，提供「再試一次」「回首頁」，並顯示錯誤代碼方便回報；
  - 版面本身出錯時（`global-error`）：翻譯和樣式都不能用，所以是中英並列的小頁面，用品牌色的行內樣式。這是唯一允許寫死文字的檔案，有測試把關。
- **載入中**：
  - 不使用全站的 `app/loading.tsx`：它會讓頁面先開始串流輸出，之後頁面裡的 `notFound()` 只能回 HTTP 200，搜尋引擎和測試都會判斷錯誤（E2E 抓到）；
  - 改成在需要等資料庫的區塊放骨架畫面（`Skeleton`），例如首頁的官方教材；
  - 練習頁本來就有「載入進度中…」的狀態。
- **無障礙**：
  - E2E 加入 axe 自動檢查（`@axe-core/playwright` 4.14.0，Deque 官方維護的開源檢查引擎）：WCAG 2.1 A／AA，主要頁面在淺色、深色、登入、未登入時都檢查，有違規就讓測試失敗；
  - 檢查發現兩個淺色模式的對比問題，調整色票：`accent-ink` #B8440A → #A63D09（主要按鈕文字原本約 4.4:1，現在約 5.1:1）、`error` #C2362B → #B3302A（約 4.5:1 → 5.1:1）。深色模式不變；
  - 新增「跳到主要內容」連結：按第一次 Tab 時出現；
  - 既有的鍵盤操作（聽寫 Enter、跟讀捷徑、對話框焦點）沿用。
- **SEO 與分享**：
  - 每頁標題加上「 · ListenLoop」；
  - 預設描述、Open Graph（網站名稱、語系）、Twitter 大圖卡片；
  - 分享圖片：1200×630，品牌色。內建字型不支援中文，所以只用英文；
  - `robots.txt` 不收錄後台、帳號、我的教材、學習進度等個人頁（這些頁面原本也有 noindex）；
  - `sitemap.xml` 列出公開頁面和每支內建影片；
  - 網址集中在 `lib/site.ts`，可以用 `NEXT_PUBLIC_SITE_URL` 覆蓋。
- **中英文完整性**：
  - 原本就有測試確認兩份翻譯檔的 key 完全一致；
  - 新增測試：`app/`、`components/` 的 .tsx 在註解以外不能有中文，只允許 global-error。
- **效能**：基準分數見 D62（Lighthouse，合併後對正式站量測）。
- **要改時**：`components/Onboarding.tsx`、`components/OnboardingStart.tsx`、`app/not-found.tsx`、`app/error.tsx`、`app/global-error.tsx`、`components/Skeleton.tsx`、`e2e/a11y.spec.ts`、`app/robots.ts`、`app/sitemap.ts`、`app/opengraph-image.tsx`、`lib/site.ts`。

## D62 效能：Lighthouse 基準；一次性提示改由伺服器決定（2026-11-07，P1）

- **基準**（2026-11-07，Lighthouse 13.5.0，正式站，Chromium 無頭模式）：

  | 頁面          | 裝置 | 效能 | 無障礙 | 最佳做法 | SEO | LCP   | CLS   |
  | ------------- | ---- | ---- | ------ | -------- | --- | ----- | ----- |
  | 首頁          | 手機 | 60   | 100    | 100      | 100 | 8.2 s | 0     |
  | 首頁          | 桌機 | 93   | 100    | 100      | 100 | 0.5 s | 0.171 |
  | 影片頁 sintel | 手機 | 64   | 100    | 96       | 100 | 7.3 s | 0.004 |
  | 影片頁 sintel | 桌機 | 97   | 100    | 96       | 100 | 1.2 s | 0.041 |
  | 第 1 天聽寫   | 手機 | 75   | 100    | 96       | 100 | 1.8 s | 0.836 |
  | 第 1 天聽寫   | 桌機 | 73   | 100    | 96       | 100 | 1.1 s | 0.991 |

- **找到的原因**：
  - 「使用提示」（D60）和「新手引導」（D61）要等瀏覽器讀完 localStorage 才顯示。插進內容上方時，把整頁往下推，所以練習頁的 CLS 接近 1；
  - 手機上，最大的內容（LCP）就是這個晚出現的提示，所以 LCP 要 8 秒左右。
- **修正**：
  - 改用 cookie 記住是否已關閉，由伺服器決定要不要顯示，提示會直接出現在第一份 HTML 裡，不再插入；
  - 新手引導也由伺服器判斷：已略過（cookie）或已登入且有練習的人不顯示，而且不包在 Suspense 裡，避免串流時晚出現。
  - 使用者按「知道了」「略過」造成的版面變化，是操作後 0.5 秒內的變化，不計入 CLS。
- **修正後的數字**（#90、#91 部署後，正式站）：

  | 頁面          | 裝置 | 效能         | LCP         | CLS           |
  | ------------- | ---- | ------------ | ----------- | ------------- |
  | 首頁          | 手機 | 60 → **95**  | 8.2 → 2.9 s | 0             |
  | 首頁          | 桌機 | 93 → **100** | 0.5 s       | 0.171 → 0     |
  | 影片頁 sintel | 手機 | 64 → **98**  | 7.3 → 2.2 s | 0.004         |
  | 影片頁 sintel | 桌機 | 97 → **100** | 0.7 s       | 0             |
  | 第 1 天聽寫   | 手機 | 75 → **90**  | 3.0 s       | 0.836 → 0.111 |
  | 第 1 天聽寫   | 桌機 | 73 → **92**  | 0.7 s       | 0.991 → 0.178 |

  無障礙、SEO 全部 100。

- **練習頁剩下的位移**：讀取進度時只顯示一行「載入中」，讀完才出現播放器和輸入框，把頁尾往下推。改成在 `DayGate` 和聽寫、跟讀的讀取狀態中，顯示和實際版面一樣大小的骨架（`PracticeSkeleton`：進度條、16:9 播放器或音訊面板、輸入區、按鈕）。本機正式版量測：CLS 從 0.111／0.178 降到 0.022／0.037（手機／桌機）。
- **之後可以再改善**：影片頁的「最佳做法」96 分，是 YouTube 播放器的第三方 cookie 與主控台訊息造成的，無法由我們修正；兩個約 37 KB 的 CSS 檔可以再研究是否重複。
- **要改時**：`lib/notices.ts`、`components/UsageNotice.tsx`、`components/Onboarding.tsx`、`components/OnboardingStart.tsx`、`app/layout.tsx`。

## D63 安全與穩定：安全標頭、速率限制、RLS 檢查、錯誤紀錄、備份（2026-11-08，P1）

- **安全標頭**：
  - 所有回應都加上：
    - HSTS（2 年，含子網域）；
    - `X-Content-Type-Options: nosniff`；
    - `X-Frame-Options: DENY`；
    - `Referrer-Policy: strict-origin-when-cross-origin`；
    - `Permissions-Policy`：只允許本站使用麥克風（跟讀需要），其他功能（相機、定位等）全部關閉；
    - `Cross-Origin-Opener-Policy: same-origin`。
  - **CSP**（`lib/security/csp.ts`）：
    - 每個請求產生新的 nonce，Next.js 自己的腳本和主題腳本都帶上它；
    - 加上 `'strict-dynamic'`，讓 YouTube IFrame API 可以載入播放器腳本；
    - 播放器只允許 `www.youtube-nocookie.com` 和 `www.youtube.com` 的 iframe；
    - 連線、音檔、圖片只允許本站和 Supabase；
    - `object-src 'none'`、`frame-ancestors 'none'`；
    - 正式環境自動把 http 升級成 https（本機的 http Supabase 除外，E2E 才能運作）。
  - 允許的網域是在 2026-11-07 用瀏覽器實際載入正式站確認的：主頁面只從 `www.youtube.com` 載入外部腳本。E2E 也會檢查主要頁面沒有任何 CSP 違規。
  - 樣式允許 inline（`'unsafe-inline'`），因為動畫用了行內的 CSS 變數；樣式無法執行程式碼，風險低，這是常見的取捨。
- **速率限制**（`lib/rate-limits.ts`、`auth/rate-limit.ts`）：
  - 用資料庫記錄固定時間窗內的次數（`rate_limits` 資料表，`hit_rate_limit` 函式），一個 SQL 敘述就完成累加和檢查，同時送出的請求也不會超過上限。
  - 登入時依帳號計算；未登入時依 IP 的雜湊計算，不儲存 IP 本身。
  - 每小時的上限：
    - 意見回饋 5 次；
    - 問題句子回報 30 次；
    - 操作紀錄 300 次；
    - 檢舉 10 次（另有每日上限）；
    - 每個 AI 步驟 600 次（另有每日費用上限，D38）；
    - 下載資料 10 次。
  - 無法連到資料庫時改成放行（fail open），並寫進伺服器紀錄，避免資料庫短暫故障把所有人擋在外面。
- **RLS 檢查**：
  - 單元測試確認每個 migration 建立的資料表都有開啟 RLS，而且只有伺服器寫入的紀錄表沒有開放給 anon；
  - `npm run rls:check` 用公開金鑰實際測試正式資料庫：讀取 15 張私人資料表、寫入 4 張表、呼叫 6 個管理函式都必須被拒絕，公開練習只能看到公開且未下架的。2026-11-08 執行結果全部通過。
- **錯誤紀錄**：
  - `instrumentation.ts` 的 `onRequestError` 把伺服器錯誤寫進 `error_logs`：時間、路徑（去掉查詢字串）、方法、類型、訊息、堆疊（遮蔽 email）、digest。
  - 錯誤頁顯示的「錯誤代碼」就是 digest，可以在「後台 → 錯誤紀錄」對到原始錯誤。保留 90 天。
  - 不使用付費的監控服務。
- **備份**：`npm run db:backup` 把每張表匯出成 JSON（`backups/`，已加入 `.gitignore`）；完整 SQL 備份與還原步驟見 `docs/backup.md`。Supabase 免費方案沒有可以還原的自動備份，所以需要手動備份。2026-11-08 已執行一次，確認腳本可以運作。
- **要改時**：`lib/security/csp.ts`、`proxy.ts`、`next.config.ts`、`lib/rate-limits.ts`、`auth/rate-limit.ts`、`instrumentation.ts`、`lib/error-log.ts`、`app/admin/errors/`、`scripts/rls-check.mts`、`scripts/backup-db.mts`、`supabase/migrations/20261108090000_rate_limits_error_logs.sql`。

## D64 PWA、App 圖示、Google Play 上架準備（2026-11-08，P2）

- **PWA**：
  - `app/manifest.ts`：名稱、短名稱、說明、`standalone`、主題色 ink（#141414）、啟動畫面底色 ground（#fafaf8）、一般與 maskable 圖示（192、512）、類別「教育」。
  - `public/sw.js`：刻意寫得很小。頁面導覽先走網路，斷線時顯示快取的 `/offline`；其他請求（腳本、Supabase、YouTube、音檔）一律不攔截，所以登入、同步和 CSP 都和沒有 service worker 時一樣。
  - service worker 只在正式版註冊，避免開發時讀到舊頁面。`/sw.js` 不快取，每次造訪都會檢查是否有更新。
  - 離線頁：說明需要網路，並提醒「進度存在這台裝置上」。
- **App 圖示**：
  - `brand/icon.svg`：深色圓角方形底，白色的循環弧線，起點有一個橘色圓點，代表「每天回到同一份素材」；只用設計系統的 ink、ground、accent。
  - 內容都在 maskable 的安全區（中心半徑 205 px）內。
  - `node scripts/brand-assets.mts` 從 SVG 產生所有尺寸：PWA 圖示、Apple 圖示、網站圖示（SVG）、Play 商店圖示 512、主題圖片 1024×500（`docs/store/`）。原本 create-next-app 預設的 favicon.ico 已移除。
  - 如果 Joe 想自己設計，規格是：512×512 PNG、內容在中心 80% 的圓內、背景不要透明；替換 `brand/icon.svg` 後重新執行腳本即可。
- **Trusted Web Activity**：`public/.well-known/assetlinks.json` 先放空陣列 `[]`（合法、不會誤認任何 App）；拿到簽署金鑰的 SHA-256 指紋後再填入。打包步驟（PWABuilder 或 Bubblewrap）見 `docs/twa.md`。
- **商店資料**：中英文的名稱、簡短說明、完整說明、分類、內容分級問卷與資料安全表單的建議答案（依目前實際收集的資料）、截圖清單與尺寸、上架順序，見 `docs/play-store.md`。
- **上架規定**（2026-11-07 查證，Google Play 說明 answer/14151465）：2023-11-13 之後建立的個人開發者帳號，申請正式版之前必須封閉測試：至少 12 位測試者，連續 14 天保持加入。建議找 15～20 位。
- **要改時**：`app/manifest.ts`、`public/sw.js`（改離線頁時把 `VERSION` 加一）、`app/offline/page.tsx`、`brand/icon.svg`、`scripts/brand-assets.mts`、`public/.well-known/assetlinks.json`、`docs/twa.md`、`docs/play-store.md`。

## D65 開發工具：自動續做、專案 skills、AI 開發紀錄（2026-11-08，P2）

- **自動續做**（`scripts/auto-continue/`、`docs/auto-continue.md`）：launchd 每 6 小時用無頭模式執行「繼續 roadmap」。
  - 安全機制：
    - 用電池就略過；
    - 鎖定資料夾防止重複執行；
    - 執行時用 caffeinate 防止睡眠，最長 3 小時；
    - 明確列出允許與禁止的工具，不跳過權限檢查；
    - 禁止刪除資料、改環境變數、強制推送；
    - `LISTENLOOP_UNATTENDED=1` 會讓所有真實 API 的腳本（fixture 錄製、官方教材、試聽範例）拒絕執行；
    - roadmap 沒有未完成項目時自動停用。
  - 每次執行都記錄：開始時間、電源狀態、做了什麼、結束原因。
  - **只建立、未安裝**：今晚嘗試安裝 LaunchAgent 時被權限檢查擋下，這是合理的，因為背景常駐的設定應該由 Joe 本人決定。安裝、啟用、暫停、看紀錄、移除的步驟見 `docs/auto-continue.md`。
- **專案 skills**（`.claude/skills/`）：
  - `add-video`：依影片製作流程，從字幕新增影片的檢查清單；
  - `verify-prod`：部署後檢查正式站（頁面、標頭、CSP、YouTube、RLS），並列出要 Joe 手動確認的後台項目；
  - `cost-report`：本週用量和每份教材的成本，用 `scripts/cost-report.mts` 讀取 `api_calls`，不呼叫任何 API。每份教材的歸屬依時間和呼叫類型推算，是近似值。
- **AI 開發紀錄**（`docs/ai-dev-log.md`）：PR 數、測試數、各里程碑日期、API 總花費，以及哪些由 Joe 決定、哪些由 Claude 完成。CLAUDE.md 加上規則：每個里程碑都要更新。
- **要改時**：`scripts/auto-continue/run.sh`（允許的工具、時間上限）、`.claude/skills/*/SKILL.md`、`scripts/cost-report.mts`、`docs/ai-dev-log.md`。

## D66 螢光筆標示（2026-11-08，講解升級 1）

- **決定**：設計系統新增兩種標示：
  - `mark-miss`：學習者聽錯或漏掉的字；
  - `mark-key`：每句的 1～2 個重點字或片語。
- **不只靠顏色**：miss 是實線底線、key 是點狀底線，並附上螢幕閱讀器文字（「你聽錯的字：」「重點：」）。
- **色票**：淺色、深色、列印各一組（見 design-system「螢光筆」）。文字固定用 ink；用 axe 在淺色和深色模式檢查，對比都通過。
  - 橘色延續品牌的 accent，用來標示「要注意」的地方；黃色是一般螢光筆的顏色，用來標示「值得學」的地方。兩者一看就能分辨。
- **列印**：底色調得更淡，並強制印出（`print-color-adjust: exact`）；只靠底線也能分辨兩種標示。
- **要改時**：`app/globals.css`（`--ll-mark-*`、`@utility mark-miss`／`mark-key`、列印的設定）、`components/Mark.tsx`、`/styleguide`。

## D67 講解第 2 版：依難度調整詳細程度（2026-11-08，講解升級 2）

- **每句一個難度**（簡單／中等／困難）：
  - 模型依句長、子句數、詞彙等級、連音判斷；
  - 程式另外依句長（12 字、22 字）、子句（連接詞與逗號）、長字（9 個字母以上）算出一個下限：模型的判斷最多只能比它低一級，所以又長又多子句的句子不會被標成簡單；
  - 困難的句子一定要有可用的意群拆解，否則顯示成中等。
- **各難度的內容**：

  |                                  | 簡單 | 中等   | 困難    |
  | -------------------------------- | ---- | ------ | ------- |
  | 重點（螢光筆）                   | 1～2 | 1～2   | 1～2    |
  | 單字、片語、慣用語               | 1～2 | 最多 3 | 最多 3  |
  | 文法                             | 無   | 0～1   | 0～2    |
  | 為什麼難聽懂（連音、弱讀、省略） | 無   | 0～2   | 0～3    |
  | 句子結構拆解與逐段意譯           | 無   | 無     | 2～6 段 |
  - 單字：詞性、中文、音標（美式 IPA）、0～3 個常見搭配詞、1 個新例句附中文；`inSentence` 記錄它在句中的寫法，用來對應聽錯的字。
  - 文法：用法說明、句中的例子（`quote`，必須真的出現在句子裡）、1 個新例句附中文、常見錯誤提醒。
  - 意群：主要子句、從屬子句、修飾語、連接詞，每段附上自己的翻譯；所有段落合起來必須正好是原句，否則丟棄。
  - Joe 要求「1～2 個例句」：目前每項給 1 個，以控制費用；之後如果想要 2 個，改提示詞和 `NOTES_LIMITS` 即可。

- **檢查**：模型的回答都經過 `lib/custom-practice/rich-notes.ts` 檢查：
  - 要引用句子的欄位（重點、句中寫法、文法例子、連音）必須真的在句子裡；
  - 長度、數量都有上限；
  - 不合格的項目直接丟棄，不會自行修改。
- **儲存與相容**：
  - 存在原本的 `practice_sentences.notes`，用 `v: 2` 區分；舊格式照常讀取；
  - 練習整體的單字、文法清單（講義、聽寫回饋用）由新格式轉換而來，所以舊的畫面不受影響；
  - 編輯頁不逐欄編輯新格式：可以選擇「儲存後重新產生」，或「改成手動編輯（簡易格式）」。
- **快取與提示詞版本**：
  - 講解的快取鍵加上 `v: 2`（`NOTES_VERSION`），同一句只產生一次，也不會拿第一版的快取來用；
  - 翻譯和斷句的提示詞沒變，所以不提高全域的 `PROMPT_VERSION`，避免所有翻譯快取失效。
- **一次的量**：每次呼叫 6 句（原本 10 句），輸出上限每句 1,000 token、加 600，最多 8,000（原本每句 700，實際執行時有一次被截斷，見 D69）。
- **費用估算**（gpt-5-mini：輸入 US$0.25、輸出 US$2.00 每百萬 token）：
  - 每次呼叫的固定輸入（指示約 2,100 字元、輸出格式約 2,000 字元）約 1,100 token，加上每句約 25 token；
  - 輸出：簡單約 200、中等約 450、困難約 750 token（依手寫的困難句範例測量）；
  - 14 份官方草稿 331 句，依程式估的難度是簡單 103、中等 214、困難 14：輸出約 127,000 token、輸入約 70,000 token，**約 US$0.27**。
  - 平均每句約輸出 380、輸入 210 token，**約 US$0.0008**；一份 30 句的教材約 US$0.025。
  - 模型可能把更多句子判為困難，所以實際可能稍高。
- **開發與測試**：只用假的供應者，以及手寫的第 2 版 fixture（`tests/fixtures/ai/azure-openai/annotate.json`，請求是程式實際送出的內容，回答是依格式寫的）。重新產生官方草稿時，會改存一份真實的回答。
- **已有的練習**：使用者自建的練習不會自動重跑；官方草稿另外用腳本升級（D68）。
- **要改時**：`lib/ai/prompts.ts`（`NOTES_INSTRUCTIONS`）、`lib/ai/notes-schema.ts`、`lib/custom-practice/rich-notes.ts`、`lib/custom-practice/notes.ts`、`lib/ai/budgets.ts`、`lib/ai/fake.ts`。

## D68 講解畫面與螢光筆標示（2026-11-08，講解升級 3）

- **`SentenceExplanation`**：聽寫答完、跟讀念完（自建練習）時顯示的講解，順序依序是：
  1. 難度標籤，以及標示的圖例；
  2. **「你這句聽錯的地方」**（只在有錯時出現，排在最前面）：聽錯或漏掉的字，以及這些字所屬的單字、文法、連音，都用 miss 螢光筆標出；
  3. 中文翻譯；
  4. 重點（key 螢光筆）；
  5. 困難句的「句子結構與逐段意譯」：每段標出角色（［主要子句］等，用括號文字，不只靠顏色），段中聽錯的字也會標示；
  6. 為什麼難聽懂（連音、弱讀、省略），聽錯的字一樣會標示；
  7. 單字與片語：音標、詞性、種類、中文、搭配詞、例句與中文；
  8. 文法：說明、句中的例子、例句與中文、常見錯誤。
  - 已經在「聽錯的地方」出現過的項目，不會在後面重複。
- **怎麼判斷聽錯**：
  - 聽寫用逐字比對的結果（和畫面上的答案比對相同）；跟讀用辨識出的文字比對，所以漏念的字一樣會被標出；
  - 講解中引用句子的部分（句中寫法、文法例子、意群、連音）會在句子裡找到位置，和聽錯的字重疊就算相關（`lib/custom-practice/marks.ts`）。
- **第一版講解**（內建影片、較早的練習）：顯示中文、單字、文法，聽錯的字和含有它的單字也會標示。
- **講義與 PDF**：
  - 句子中標出這週第 1 天聽錯的字（miss）和每句重點（key），上方有圖例和說明；
  - 第 2 版講解的練習，另外列出困難句的意群、連音，單字表加上音標、搭配詞和例句的中文，文法加上句中的例子、例句中文和常見錯誤；
  - 和第 1 天聽錯有關的單字、文法也會標示。列印時沿用 D66 的列印樣式。
- **聽寫的講解側欄**：寬螢幕時固定在右側，內容變長後可以捲動；捲動區可以用鍵盤聚焦，並有名稱「這句的講解」。這是 axe 檢查時發現並修正的。
- **順帶修正**：考試目標程度的翻譯鍵含有「.」（例如 `ielts-6.5`），next-intl 不允許，會在載入翻譯時報錯。翻譯鍵改成 `ielts-6_5`（`targetMessageKey`）；存在資料庫的 id 不變。新增測試，確保翻譯鍵不含「.」。
- **要改時**：`components/SentenceExplanation.tsx`、`components/Handout.tsx`、`components/HandoutGate.tsx`（第 1 天的答案）、`lib/custom-practice/marks.ts`、`components/DictationSession.tsx`、`components/ShadowingSession.tsx`。

## D69 官方草稿的講解升級到第 2 版（2026-11-08，講解升級 4）

- **怎麼升級**：`npm run notes:upgrade`（`scripts/upgrade-notes.record.ts`）用真的供應者，替 14 份官方範例草稿（D59，以 id 指定）的每一句重新產生第 2 版講解，音檔不重做。
  - 資料庫函式 `upgrade_practice_notes` 在一個交易裡完成：把目前版本存成快照、換上新講解、練習版本加 1。所以舊講解保留在快照裡，已經開始的 7 天循環會繼續看到它開始時的版本（D44）。
  - 只有伺服器的秘密金鑰能呼叫這個函式。
- **一般使用者的練習不會自動升級**：之後如果要升級，再另外決定（例如在編輯頁按「儲存後重新產生講解」，或由管理員批次升級）。
- **省錢規則**：
  - 預設只印出計畫和預估，要加 `UPGRADE_YES=1` 才會呼叫；
  - 每次呼叫前先預留最壞情況，超過 US$0.50 就停止；
  - 已經是第 2 版的練習會跳過，中途停止可以直接重跑；
  - 每次呼叫都寫進 `api_calls`。
- **真實 fixture**：同一次執行也把一句困難句的真實回答錄成 `tests/fixtures/ai/azure-openai/annotate.json`，取代手寫的版本；測試改成檢查結構，不檢查模型每次都可能不同的文字。
- **成本守門程式共用**：`scripts/cost-guard.ts`，建立官方草稿和升級講解兩個腳本都使用。
- **執行時遇到的問題與修正**：
  - **輸出被截斷**：第一次執行時，有一次呼叫超過輸出上限（每句 700 token）被截斷，依規則停止。已改成每句 1,000、加 600；截斷前完成的講解已經在快取裡，重跑不會重複花費。剩下的預算是 US$0.50 減掉已花的部分。
  - **錯誤的連音說明**：真實回答把「going to the library」說成「gonna」。going to 只有接動詞時才會唸成 gonna。現在有兩道防線：
    1. 檢查程式（`impossibleReduction`）：going to／want to 後面接冠詞、所有格或地點名詞時，丟掉說成 gonna／wanna 的連音說明。顯示時也會重新檢查，所以已經產生的講解也會自動套用；
    2. 提示詞寫明這個規則，並要求只描述這句實際會發生的連音。提示詞改了，所以 fixture 重新錄了一次。
- **結果（2026-11-08）**：
  - 13 份升級到第 2 版；「Study Plans for the Midterm」被官方帳號的**每日費用上限**擋下（保護機制，沒有調高），台灣時間隔天重設後用同一個指令補跑，預估約 US$0.02。
  - 實際花費（`api_calls`）：講解 70 次呼叫（1 次被截斷失敗），輸入 68,187、輸出 185,237 token，**US$0.3875**；在 US$0.50 的額度內。
  - 補跑時重新錄的 fixture 有一個片語沒有 IPA（格式允許），所以保留前一次錄好的 fixture，沒有改測試。
- **注意**：14 份裡的「First Order at the Coffee Shop」在 2026-11-08 03:29 被取消官方教材（管理稽核有紀錄），這次升級不改變它的狀態。
- **要改時**：`scripts/upgrade-notes.record.ts`、`supabase/migrations/20261108120000_upgrade_practice_notes.sql`、`scripts/cost-guard.ts`。

## D70 教材庫：影片與音檔合一、篩選存在網址（2026-11-08，新產品方向 1）

- **決定**：首頁的「推薦練習」（內建影片，依合集分組）和「ListenLoop 官方教材」合併成一個**教材庫**。資料統一成 `LibraryItem`（`lib/library.ts`），伺服器端由 `getLibraryItems`（`auth/library.ts`）組合，瀏覽器端篩選（清單小，不需要分頁）。
- **篩選**：類型、分類、程度、長度、口音，可複選；同一組是「其中之一」，不同組是「而且」。另加「每天練習時間」（10／20／30 分鐘內，單選）、搜尋（標題＋副標）、排序（推薦、最新、最短、最多人練）。全部存在網址參數（`q`、`type`、`cat`、`level`、`length`、`accent`、`min`、`sort`），重新整理和分享連結都保留；不認得的值忽略。
- **合理的預設**：
  - 內建影片的類別對應到教材分類：daily → 日常生活、campus → 校園、business → 職場、interview 與 story → 演講與故事（`VIDEO_CATEGORY_IN_LIBRARY`）。
  - 內建影片沒有建立時間，排序「最新」時視為 2026-10-24（第一支影片上架日）。
  - **推薦順序**：先依管理員排的官方順序，再依程度由淺到深、短的在前。
  - **每天預估時間** = 長度 × 4（`PRACTICE_TIME_FACTOR`，`lib/library-config.ts`），無條件進位到分鐘。理由：聽寫要逐句播放、重播、打字，跟讀要播放和錄音，實測大約是原長的 3～5 倍。之後有練習時間紀錄（D74）後，改用實際平均。
  - **音檔長度**：從語音檔大小推算（Azure 輸出固定 48 kbit/s MP3），由資料庫函式 `practice_audio_bytes` 加總，不用另外補資料；不知道時用「每句 12 字、每分鐘 130 字」估。
  - 長度新增「1 分鐘以內」，因為音檔教材可能比正式影片短。
  - 「最多人練」用 `material_learner_counts()`：只回傳每份教材的人數，不含任何個人資料。
  - 篩選組只有一種值時不顯示（例如目前只有一支影片時，類型仍顯示，因為有影片和音檔兩種）。
- **首頁順序**：登入後是今日任務 →「我今天有幾分鐘？」→ 教材庫；未登入是產品介紹（三個步驟＋登入）→ 教材庫。練習日曆移到「學習進度」頁。新手引導只給已登入、還沒有練習的人，未登入由產品介紹取代，避免兩個說明框重複。
- **元件**：`MaterialCard`（取代 `PracticeCard` 和題庫卡片，`/explore` 也用）、`Tag`、`LibraryFilters`、`Dialog` 的 `sheet`（手機底部抽屜），規格寫在 `docs/design-system.md`，`/styleguide` 有範例。
- **不新增套件**。
- **要改時**：`lib/library.ts`、`lib/library-config.ts`、`auth/library.ts`、`components/MaterialLibrary.tsx`、`components/MaterialCard.tsx`、`supabase/migrations/20261108140000_library.sql`。

## D71 教材副標：AI 產生、管理員可改（2026-11-08，新產品方向 2）

- **決定**：每份教材有一句繁體中文副標，顯示在教材卡片的標題下方。
  - 音檔教材存在 `practices.subtitle`（60 字以內）；內建影片寫在影片 JSON 的 `subtitle`（手寫）。
  - 新增 AI 工作 `describe`：讀標題和正文前 600 字元，回傳 `{ subtitle }`（30 字以內，提示詞在 `lib/ai/prompts.ts`），輸出上限 300 token。檢查程式 `lib/custom-practice/subtitle.ts` 會去掉包住整句的引號、壓縮空白，超過 60 字就不用。
- **什麼時候產生**：管理員把教材**發布到教材庫**時，如果還沒有副標就自動產生。這是盡力而為：AI 失敗或達到每日上限，教材照樣發布，之後可以在後台補。一般使用者自己建立的練習不產生，因為它們不會出現在教材庫，也不多花費用。
- **後台**：`/admin/materials` 每份教材可以直接輸入副標、清除，或按「用 AI 重新產生」；每次變更都寫進管理稽核（`practice.subtitle`）。
- **14 份官方草稿**：`npm run subtitles:record`（`scripts/subtitles.record.ts`）一次補上。預設只印預估，加 `SUBTITLES_YES=1` 才呼叫；第一次的回答存成 fixture（`tests/fixtures/ai/azure-openai/describe.json`），不另外多呼叫。
  - 實際花費（2026-11-08）：14 次呼叫，輸入 3,939、輸出 467 token，**US$0.0019**。
- **共用**：14 份草稿的 id 移到 `scripts/draft-ids.ts`，升級講解與副標兩個腳本都使用。
- **要改時**：`lib/custom-practice/subtitle.ts`、`lib/ai/prompts.ts`（`DESCRIBE_INSTRUCTIONS`）、`app/admin/materials/actions.ts`、`components/MaterialControls.tsx`。

## D72 方案：免費試用 1 份、付費每月 30 份、等候名單（2026-11-08，新產品方向 3；取代 D54 的部分內容）

- **決定**（Joe 指定）：
  - **免費**：所有官方教材與功能，加上**試做 1 份**自己的教材；
  - **付費**：每月建立 30 份，每份最多 2,000 字；
  - **管理員**：不限。
  - 數字都在 `lib/plans.ts` 的 `PLANS`；程式只透過 `can(plan, action)` 判斷。D54 的「建立練習只限管理員」不再適用；Joe 提到的「一般使用者每月 3 份」設定沒有在程式裡出現過，這次一併以新規則為準。
- **合理的預設**：
  - 免費方案每份也是 2,000 字（和付費相同），避免試用那一份就花掉大量額度。
  - 「試做 1 份」用 `profiles.practices_created` 計算：資料庫觸發器在每次新增練習時加 1，**刪除練習不會減少**，所以刪掉不能重新試用。既有帳號在 migration 時依現有練習數補上。
  - 付費方案的每月份數沿用 D54 的算法（本月建立、仍存在的練習數）。
  - 方案存在 `profiles.plan`（`free`／`paid`），付費功能上線前由管理員在 `/admin/users/<編號>` 手動切換，寫進管理稽核（`user.plan`）。
- **防止超額花費**：建立前每個會呼叫 AI 的步驟（斷句、翻譯、AI 產生文字）和存檔時都檢查方案額度（`auth/creation-quota.ts`）；已經建立的那一份，之後產生講解和音檔不受影響。編輯練習也檢查每份字數。
- **超過額度時**：`/materials/new` 不顯示建立表單，改成付費方案卡片（內容、價格「即將推出」、「加入等候名單」）。等候名單存在 `waitlist` 資料表（使用者只能新增、讀取自己那一筆）；管理員在 `/admin` 總覽看到人數與名單。
- **隱私權政策**：一般使用者現在也會把文字送到 AI 服務，所以更新相關段落（最後更新日改為 2026-11-08）。
- **影響**：Google 登入仍是「測試」狀態，只有測試使用者能登入；每人每天的費用上限（`DAILY_LIMITS`）照常有效。
- **要改時**：`lib/plans.ts`、`auth/creation-quota.ts`、`components/PaidPlanCard.tsx`、`app/plans/actions.ts`、`supabase/migrations/20261108160000_plans_waitlist.sql`。

## D73 音檔調速與加權正確率（2026-11-08，新產品方向 4）

- **決定**（Joe 指定）：音檔教材提供 0.75×／1×／1.25×，不改變音調（`preservesPitch`）；YouTube 影片不提供（CLAUDE.md 的 YouTube 規則不變）。每次作答記錄當時的速度，正確率依速度加權：0.75× → 90%、1× → 100%、1.25× → 105%，最高 100%；Day 7 的 80% 門檻用加權後的分數。數字集中在 `lib/speed.ts`。
- **合理的預設**：
  - **加權方式**：逐句計算。每句對到的字數乘上該句速度的權重，分母和原始正確率一樣（`max(原句字數, 輸入字數)` 的總和），最後上限 100%。所以混合速度時，每句各自依速度計分。
  - **「慢速完成」／「快速完成」**：依字數加權的平均速度小於 1 是慢速、大於 1 是快速，剛好 1（全程 1×，或慢快各半）不標示。
  - **原始分數保留**：`score` 仍是原始正確率，另外存 `weightedScore` 和每句的 `speeds`；舊資料沒有這些欄位，視為 1×（加權等於原始），所以進行中的循環不受影響。每週紀錄另存 `day1Weighted`、`day7Weighted`。
  - **第 1 天和第 7 天對比**：整體分數用加權分數（和通過與否一致），逐句比較用原始正確率。
  - **重練**：同樣可以調速、顯示加權分數，但不儲存（重練規則不變）。
  - **跟讀**：也可以調速，方便慢慢跟念；跟讀沒有分數，所以不加權。
  - 速度選擇不記住，每次打開練習都從 1× 開始，避免學生忘記自己開了慢速。
- **分析與後台**：學習分析與後台會同時顯示原始與加權（D75）。
- **要改時**：`lib/speed.ts`、`lib/dictation.ts`、`lib/cycle.ts`（`officialScore`、`settleWeek`）、`components/SpeedControl.tsx`、`components/audio/useAudioPlayer.ts`。

## D74 練習時間記錄（2026-11-08，新產品方向 5）

- **決定**（Joe 指定：只算前景且有互動的時間，閒置超過 2 分鐘不算）：練習時間記在練習紀錄 `ll-activity:v1` 每天的 `time` 欄位，格式 `{ 裝置 id: { 教材 id: 秒數 } }`，跟著原本的活動紀錄一起同步到雲端（`user_documents` 的 `activity`），不另外開新的資料表。
- **怎麼算**（`lib/practice-time.ts` 的 `isPracticing`，`components/usePracticeTimer.ts` 每秒判斷一次）：
  - 只在聽寫、跟讀頁計時；
  - 分頁必須在前景（`visibilityState`）；
  - 視窗有焦點，而且 2 分鐘內有按鍵、點擊、輸入或捲動；或者音檔、影片正在播放（播放時不需要輸入）。
  - 每 30 秒、切到背景或離開頁面時存一次。
- **合理的預設**：
  - **跨裝置不重算也不漏算**：每台裝置只加自己的計數（裝置 id 是隨機產生、存在 `ll-device:v1`）。合併時每台裝置、每份教材取較大值，再把裝置加總。
  - 依教材分開記錄，之後「每天預估時間」可以改用實際平均（D70 的 `MIN_TIMED_SESSIONS`）。
  - 未登入時只存在這台裝置，登入後跟著活動紀錄同步。
- **要改時**：`lib/practice-time.ts`（`IDLE_LIMIT_MS`、`SAVE_EVERY_MS`）、`components/usePracticeTimer.ts`、`lib/sync/merge.ts`。

## D75 學習分析頁與全站分析（2026-11-08，新產品方向 6）

- **決定**：新增登入後的「學習分析」`/stats`：連續練習天數、每日練習時間（週／月）、正確率趨勢（加權與原始）、每份教材的第 1 天與第 7 天、最常聽錯的前 10 個字、練習的分類與程度分布。後台總覽加上全站平均每日練習時間、30 天活躍人數趨勢、平均正確率（加權與原始）。
- **不新增圖表套件**：需要的只有長條、橫條和一條折線，用 HTML／CSS（加一段 SVG 折線）就能做到，而且文字可以維持設計系統的字級、自動支援深色模式；Recharts 等套件會增加約 100 KB 以上的 JavaScript。
- **合理的預設**：
  - **資料來源**：全部從既有紀錄計算（進度、活動紀錄、D74 的練習時間），不新增資料表。學習分析在瀏覽器讀這台裝置的資料（登入後會和帳號同步）；伺服器只提供教材的標題、分類、程度和句子（`auth/stats-materials.ts`）。
  - **連續練習**：有正式任務或有記錄到練習時間的日子都算；今天還沒練時，從昨天往回算。
  - **正確率趨勢**：每次完成的第 1 天、第 7 天聽寫各一點；之前幾週的成績用活動紀錄裡的完成日期定位，找不到日期的不畫。
  - **最常聽錯的字**：目前保存在進度裡的第 1、7 天答案（重來一週後，舊答案已經不在）；不分大小寫，同樣次數依字母排序。功能詞（a、the）也算，因為聽不出來正是要練的。
  - **後台平均正確率**：所有使用者目前進度裡完成的聽寫（每次一筆）；平均練習時間是「當天有練習的人」的平均。只顯示加總數字，不列出任何人。
  - **練習日曆**：移到「學習進度」頁（D70）。
- **無障礙**：每張圖有一句摘要（螢幕閱讀器讀這句）和完整資料表；對照數列除了顏色還有虛線或數字。圖表配色用 dataviz 的檢查程式驗證過：主色和對照色在色盲模擬下仍可區分（ΔE ≥ 13）；對照色本來就是灰色（刻意的「重點＋對照」，不是兩個分類色），所以另外用虛線區分。
- **要改時**：`lib/analytics.ts`、`components/StatsView.tsx`、`components/charts/`、`app/stats/page.tsx`、`app/admin/page.tsx`。

## D76 手機逐頁檢查與點擊範圍（2026-11-08，新產品方向 7）

- **怎麼檢查**：用 Playwright 在 375px、觸控模式（`hasTouch`、`isMobile`）打開每一頁（未登入、一般帳號、管理員共 19 頁），自動找出：高度小於 44px 的可點元素、小於 12px 的字、橫向捲動；再逐頁看截圖。
- **結果**：沒有橫向捲動、沒有小於 12px 的字。點擊範圍不足的有頁首導覽（24px）、頁尾連結（24px）、每頁上方的「← 返回」（21px）、展開資料表與「中文」的 `<summary>`、後台篩選下拉（41px）。
- **決定**：新增 `tap` 工具類別（`app/globals.css`），只在觸控裝置把元素撐到 44px，滑鼠操作的外觀不變；後台欄位加 `pointer-coarse:min-h-11`。段落中的行內連結不改。
- **順便**：首頁的標語和產品介紹標題幾乎一樣，介紹標題改成「怎麼練：七天一個循環」。
- **要改時**：`app/globals.css`（`tap`）、`components/SiteHeader.tsx`、`components/SiteFooter.tsx`。

## D77 AI 額度：依身分與工作類型分開，加上全站每月上限（2026-11-08，第二輪 1）

- **決定**（Joe 指定）：
  - 每日 AI 費用上限：管理員手動 US$1.00、管理員批次 US$1.00、付費使用者 US$0.20、免費使用者 US$0.05；
  - 全站每月 AI 費用總上限 US$8（保護 Azure 學生額度），超過時暫停一般使用者建立，管理員仍可手動建立；
  - 達到 80% 時，後台總覽顯示警告。
- **做法**：
  - 預設值在 `lib/usage.ts` 的 `DEFAULT_USAGE_SETTINGS`；管理員在 `/admin/usage` 的「AI 額度設定」修改，存在 `usage_settings`（只有伺服器能讀寫），每次修改寫進管理稽核。讀不到設定時一律用預設值，不會因為設定出錯而解除上限。
  - 批次作業（講解升級、副標、建立官方草稿的腳本、後台的批次重新產生講解）記在新的 `api_batch_cost`，和手動的 `api_daily_cost` 分開，所以批次不會用掉手動建立的額度。
  - 每月上限用 `month_api_cost` 加總本月（台灣時間）`api_calls` 的費用，在預留之前檢查；管理員不檢查。
- **合理的預設**：
  - 每月上限的檢查不是原子操作：多人同時建立時可能稍微超過。上限是保護用的，誤差只有一次呼叫的大小，可以接受。
  - 聲音仍用每日字元上限（16,000；批次 120,000），因為 F0 免費，真正的限制是每月 50 萬字元。
  - 提示文字依類型（每日、批次、每月、聲音）說明何時重設（台灣時間，24 小時制）；管理員另外看到「查看後台用量 →」。
  - 舊的「每人每天 US$0.50」不再使用。
- **要改時**：`lib/usage.ts`、`auth/creator.ts`（`supabaseUsageMeter`、`creatorMeter`、`getBatchCreator`）、`auth/usage-settings.ts`、`components/UsageLimitMessage.tsx`、`supabase/migrations/20261108180000_usage_buckets.sql`。

## D78 翻譯直接放在英文句子下方（2026-11-08，第二輪 2）

- **決定**（Joe 指定）：聽寫作答後、聽寫結果、第 7 天週結果、跟讀、講義與 PDF、編輯頁，每句的中文都在該句英文正下方（supporting、ink-muted），單字與文法講解在翻譯下方。
- **做法**：
  - 聽寫：移除寬螢幕的右側講解欄（`practice-column-notes`），講解改放在按鈕下方，所有寬度同一欄。
  - `SentenceExplanation` 新增 `showZh`；中文已經在句子下方的地方傳 `false`，避免同一頁出現兩次。
  - 跟讀：影片教材的中文原本收在「中文」展開項裡，現在直接顯示（和音檔教材一致）。
  - 講義、PDF、編輯頁原本就是英文下方中文，不變。
- **取捨**：寬螢幕少了「影片和講解並排」，講解要往下捲才看得到；換來的是翻譯緊貼句子、閱讀順序一致（英文 → 中文 → 講解）。
- **要改時**：`components/DictationSession.tsx`、`components/ShadowingSession.tsx`、`components/SentenceExplanation.tsx`、`components/WeekResult.tsx`。

## D79 首頁結構與情境篩選（2026-11-08，第二輪 3；修訂 D70）

- **決定**（Joe 指定）：
  - 已登入：練習日曆 → 今日任務 → 官方教材庫；
  - 未登入：產品簡介與「怎麼練」三步驟 → 官方教材庫；
  - 「學習進度」頁保留完整版。
- 官方教材庫（標題改成「官方教材庫」）所有人都看得到，包含搜尋與篩選：類型、類別與**情境**、程度、長度、口音、「我今天有幾分鐘」。
- **合理的預設**：
  - 「我今天有幾分鐘？」從登入後的首頁區塊移到教材庫最上方，所有人都能用；篩選側欄不再重複這一組，「篩選（N）」的數字也不算它。
  - **情境篩選**：選了類別後才出現，只列所選類別裡實際有教材的情境；網址參數 `sc`。內建影片沒有情境，選了情境時不會出現。
  - 取消一個類別時，它底下已選的情境一起取消，避免留下看不到的條件。
- **要改時**：`app/page.tsx`、`components/MaterialLibrary.tsx`、`lib/library.ts`、`auth/public-practices.ts`。

## D80 官方教材的管理入口與複製（2026-11-08，第二輪 4；修訂 D46、D58）

- **決定**（Joe 指定）：
  - 官方教材發布後一律公開、出現在首頁教材庫；草稿只有管理員看得到；
  - 管理員的「我的教材」只列個人練習；
  - 頁首新增「官方教材」入口（`/admin/official`），集中管理：草稿與已發布、建立新官方教材（AI 生成）、編輯、發布與取消發布、排序、依類別篩選、批次重新產生講解；
  - 從個人練習「設為官方教材」改成**複製一份**，原本的保留。
- **做法**：
  - 資料庫函式 `copy_practice_as_official(source, actor)`（只有伺服器能呼叫）：複製練習與每句的英文、中文、音檔路徑、講解、說話者，成為官方草稿，擁有者是操作的管理員。音檔與講解沿用，不重新產生、不花費。
  - 「建立新官方教材」用原本的建立頁加上 `?official=1`：建立後直接標成官方草稿，完成後回到官方教材頁。用的是管理員手動額度。
  - 批次重新產生講解：`upgradeOfficialNotes` 每次處理一批句子（共用快取），全部有最新版講解時呼叫 `upgrade_practice_notes` 建立新版本（舊講解留在版本紀錄，D44）。用批次額度（D77）；已經是最新版的不呼叫、不花費。所以「重新產生」實際上是「更新到最新版」：同一句同一版的講解在快取裡，重做也會得到一樣的結果。
  - `/admin/materials` 改成「公開教材」，只管一般公開與已下架的練習。
- **合理的預設**：
  - 編輯頁仍然只有建立者能開（擁有者檢查不變）；其他管理員可以發布、排序、改分類與簡介。
  - 官方教材的狀態選單保留「不是官方」，選了會變回那位管理員的個人練習（出現在他的「我的教材」）。
- **要改時**：`app/admin/official/`、`components/OfficialNotesUpgrade.tsx`、`components/OfficialToggle.tsx`、`app/materials/organize-actions.ts`（`copyAsOfficial`）、`supabase/migrations/20261108200000_official_copy.sql`。

## D81 AI 生成：更多類別與情境、自訂情境、標題規則（2026-11-08，第二輪 5；擴充 D57）

- **決定**（Joe 指定）：
  - 新增 8 類：健康與醫療、家庭與人際、科技與網路、理財與行政、求職與職涯、運動與休閒、美食與烹飪、文化與節慶，包含 Joe 列的情境；
  - 每一類（新舊都算）至少 8 個情境，集中在 `lib/categories.ts`；
  - 新增「自訂情境」：可以和類別一起用，也可以單獨用；
  - 標題：有填就原樣保留，AI 不能改；沒填由 AI 依內容取。預覽時都可以修改。
- **合理的預設**：
  - 舊類別補的情境：旅遊（火車站、預訂一日遊）、校園學術（實驗室安全、校園導覽）、學術寫作（研究計畫、同儕互評、論文口試）、新聞（體育、藝文、科學，內容一律虛構）、科普（太空、氣候、營養）、演講與故事（Podcast 訪談、書評、旅行故事）。情境 id 全站唯一，測試會檢查。
  - 新類別排在原本 10 類之後、考試之前，避免改變既有的順序。
  - 自訂情境最多 200 字；不選情境時一定要填。考試類不提供「只用自訂情境」，因為題型是固定的。
  - **標題保留**：伺服器端把結果的標題換回使用者填的（只去掉前後空白），不依賴模型照做；提示詞也會要求內容配合標題。
  - **不重錄 fixture**：自訂情境和標題只在有填時才加進提示，沒填時送出的請求和原本完全一樣，所以已錄製的真實回答仍然可用，這次沒有任何真實呼叫。
- **要改時**：`lib/categories.ts`、`lib/custom-practice/generation.ts`、`lib/ai/prompts.ts`（`composeInstructions`）、`components/GenerateTextPanel.tsx`、`app/materials/actions.ts`（`generatePracticeText`）。

## D82 建立表單（AI 生成）的順序、自訂類別、預設獨白（2026-11-08；修訂 D57、D81）

- **決定**（Joe 指定）：
  - 標題欄位移到表單最上方，說明改為「有填的話，標題會原樣保留，內容依標題、類別、情境和描述生成；沒填的話由 AI 依內容取標題，生成後都可以修改。」；
  - 刪除「主題或關鍵字」，用途併入自訂情境；
  - 類別選單最後加「自訂類別」，選了會出現類別名稱欄位，AI 生成時參考；這類練習在篩選中歸為「其他」；
  - 「形式」預設獨白；
  - 整理順序與說明，手機版也確認。
- **合理的預設**：
  - **一個標題欄位**：原本 AI 面板裡另有一個標題欄位，和表單上方的「標題」重複；現在只留最上方一個，AI 模式顯示「（選填）」和說明，貼上文字時就是「標題」。
  - **欄位名稱**：自訂情境改叫「想練什麼？」，說明可以寫情境、主題或關鍵字，中英文都可以。「只用自訂情境」改名「其他（自己描述）」，放在情境清單的最後，不再排第一個，第一次使用的人不會先看到一個「不選」。
  - **自訂類別**：類別名稱必填，最多 40 字；沒有情境清單，「想練什麼」可填可不填。存成 `category = "other"`、沒有情境；類別名稱只用在生成，不另外存。新增分類 id `other`（`OTHER_CATEGORY`），教材庫篩選和後台分類選單都會出現「其他」。
  - **形式**：預設獨白，選情境時也不再自動切成對話，由使用者自己決定。
  - **必填提示**：類別名稱或「想練什麼」還沒填時，「生成文字」按鈕停用，下方說明缺什麼。
  - **伺服器端**：`topic` 欄位保留（批次腳本仍會用），畫面送出空字串；自訂類別和自訂情境一樣，只在有填時加進 AI 的指示，沒填時請求和以前相同，已錄製的 fixture 仍可使用，這次沒有真實呼叫。
  - 額度設定不變。
- **要改時**：`components/GenerateTextPanel.tsx`、`components/CreatePracticeForm.tsx`、`lib/custom-practice/generation.ts`、`lib/categories.ts`（`OTHER_CATEGORY`）、`lib/ai/prompts.ts`。

## D83 雙語標題（2026-11-08，夜間任務二）

- **決定**（Joe 指定）：每份教材（官方、使用者自建、影片）都有英文與中文標題，一律先英文後中文；每份都有一句中文副標題。使用者輸入的語言原樣保留（只去前後空白），由伺服器保證；另一種語言自動產生，可在預覽與編輯頁修改。卡片第一行英文、第二行中文、第三行副標題；空間不夠時用「English Title｜中文標題」單行並截斷。搜尋同時比對雙語標題與副標題。
- **資料**：`practices` 新增 `title_en`、`title_zh`（只新增的 migration），保留原本的 `title` 當作相容欄位（等於英文標題，沒有英文時是中文）。內建影片的 JSON 新增 `titleZh`。舊資料只有 `title` 時，依有沒有漢字判斷它是哪種語言（`lib/titles.ts` 的 `practiceTitles`）。
- **現有資料**：17 份教材的雙語標題、3 份個人練習缺少的副標題由 Claude 撰寫寫入資料庫，沒有呼叫 Azure。使用者原本打的標題（例如「張多啦」、「With Stephen Miller pick, …」）原樣保留在原本的語言欄位，只補另一種語言。
- **合理的預設**：
  - 單行標題後面接其他資訊時改用「 · 」（例如「Sintel｜辛特爾 · 第 1 天 聽寫」），避免兩個「｜」難讀。
  - 舊版本（D44）的練習也顯示目前的雙語標題：標題不跟著版本走。
- **要改時**：`lib/titles.ts`、`components/MaterialTitle.tsx`、`supabase/migrations/20261109000000_bilingual_titles.sql`；建立與編輯流程見下面的補充。

### D83 補充：建立與編輯（2026-11-09）

- **不多花一次呼叫**：翻譯併進原本的呼叫。
  - AI 生成（compose）本來就會寫標題，現在同一次回傳 `title`（英文）、`titleZh`、`subtitle`。
  - 貼上文字建立時，本來就有 describe 呼叫（只寫副標），現在同一次回傳 `titleEn`、`titleZh`、`subtitle`。
  - 兩種標題都填了、也有副標時，不呼叫。
- **使用者打的字由伺服器保證**：`keepTypedTitles` 在 `generatePracticeText`、`describeDraft`、`createPractice` 都會套用。打了的語言只去前後空白，模型的版本只用在空著的語言。提示詞也會告訴模型「這個標題照原樣用」，但不依賴模型遵守。
- **相容**：舊版用戶端只送 `title` 時，依有沒有漢字判斷是哪一種語言。編輯時沒有送 `titleEn`／`titleZh`，就不改雙語標題。
- **合理的預設**：
  - 檔名當成標題時，依有沒有漢字放進中文或英文欄。
  - 編輯頁不呼叫 AI 補另一種語言：作者可以留空，卡片只顯示有的那一行。
  - 副標題超過 60 字或空白時存成 null，發布時再由 D80 的流程補上。
- **fixture**：提示詞和回傳格式改了，`tests/fixtures/ai/` 的 compose、describe 錄製檔在第六項實測時重新錄製。在那之前，比對時略過提示詞（`sameExceptPrompt`）。
- **要改時**：`lib/ai/prompts.ts`（`composeInstructions`、`DESCRIBE_INSTRUCTIONS`）、`app/materials/actions.ts`（`describeDraft`、`createPractice`）、`app/materials/edit-actions.ts`（`editLabels`）。

## D85 金流準備：供應者介面、假的供應者、webhook（2026-11-09，夜間任務四）

- **決定**（Joe 指定只用假的供應者）：金流透過 `PaymentProvider` 介面接上，用環境變數切換供應者。目前只有假的供應者，正式站不開放結帳。供應商比較與建議見 `docs/payments.md`。
- **業界做法**：
  - webhook 用 HMAC-SHA256 驗章並檢查時間戳記（5 分鐘），防止偽造與重放；
  - 以事件 ID 做冪等（`payment_events`），同一事件只套用一次；
  - 訂閱事件依發生時間排序，舊的不覆蓋新的；
  - 套用失敗會回 500 並釋放事件，讓供應者重試。
- **合理的預設**：
  - 價格暫定 NT$149／月、NT$1,490／年（年繳 = 10 個月），集中在 `lib/payments/pricing.ts`；全額退款期限 7 天（`REFUND_DAYS`）；沒有免費試用（`TRIAL_DAYS = 0`）。
  - `profiles.plan` 仍是唯一的權限依據：訂閱 active 或 past_due 是付費，expired 是免費。管理員手動改的方案照舊有效，下一個訂閱事件會再依訂閱狀態更新。
  - 降級不刪任何教材，只是不能新增（`PLANS.free`）。
  - 金額存成幣別的最小單位（新台幣沒有小數，所以 NT$149 存 149）。
  - 假的供應者在 `VERCEL_ENV=production` 一律停用，避免正式站出現測試付款。
- **要改時**：`lib/payments/`、`auth/payments.ts`、`app/payments/webhook/route.ts`、`supabase/migrations/20261109010000_payments.sql`。

### D85 補充：定價、結帳、帳號、後台、法律頁（2026-11-09）

- **頁面**：
  - `/pricing`：免費與付費並排，可切換月繳／年繳，預設年繳；
  - `/checkout/fake`：只有假的供應者才有；
  - `/checkout/success`、`/checkout/failed`；
  - `/account#billing`：目前方案、下次扣款日、取消／恢復續訂、付款紀錄；
  - `/admin/revenue`：統計、訂閱、付款、退款、測試用的模擬；
  - `/admin/waitlist/export`：等候名單 CSV；
  - `/refund`：退款政策。
- **合理的預設**：
  - 付款服務還沒設定時，付費方案顯示「即將推出」，按鈕是「加入等候名單」（沿用 D72）；
  - 假的供應者會在頁面上方顯示「測試模式」，後台營收標示「測試」；
  - 取消一律是「期末取消」（cancel at period end），不提供立即終止。這是訂閱服務的業界慣例，使用者已付的這一期仍可使用；
  - 退款要由管理員在後台操作，按兩次確認，並寫入管理稽核。使用者透過意見回饋申請，政策寫在 `/refund`；
  - 新台幣顯示成「NT$1,490」（`formatPrice`），不顯示小數；
  - 結帳與改訂閱有速率限制：每小時 20 次（`RATE_LIMITS.billing`）；
  - 頁尾新增「方案與價格」「退款政策」；服務條款新增第 7 條「付費方案與訂閱」（後面的條號往後移）；隱私權政策新增「付款資料」。
- **要改時**：`components/PricingPlans.tsx`、`components/BillingSection.tsx`、`app/billing/actions.ts`、`app/admin/revenue/`、`messages/*.json` 的 `pricing`、`checkout`、`billing`、`refund`、`admin.revenue`。

## D86 AI 模擬使用者測試與修正（2026-11-09，夜間任務三）

- **決定**（Joe 指定）：用 Playwright 模擬 7 個角色操作 11 個任務，評 Nielsen 嚴重度並修正。角色見 `docs/personas.md`，結果見 `docs/usability-ai-test.md`；之後用 skill `ai-usability-test` 重跑。
- **這一輪的修正**：
  - 手機的主題切換從頁首移到頁尾，頁首少一行；
  - 「訂閱」按鈕顯示週期與金額；
  - 中文標題與副標題標上 `lang="zh-Hant"`；
  - 影片出處的連結點擊範圍至少 32 px；
  - 字放大時，搜尋欄可以縮小、`SegmentedControl` 會換行、過長的字會斷行（`body` 的 `overflow-wrap: break-word`）；
  - 觸控裝置不顯示鍵盤快捷鍵提示。
- **合理的預設**：
  - 模擬測試的截圖不進 git（`usability-results/`），只留報告；
  - 量測時，段落裡的文字連結不算點擊目標（依 WCAG 2.5.8 的例外）；
  - 模擬 SUS 只用來比較前後，不代表真實分數。
- **要改時**：`usability/tasks.spec.ts`、`usability/playwright.config.ts`、`.claude/skills/ai-usability-test/SKILL.md`。
