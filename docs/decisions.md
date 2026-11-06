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
