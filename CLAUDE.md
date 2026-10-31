# ListenLoop — 週循環英語聽力練習 App

線上網址：https://listenloop-three.vercel.app
GitHub：https://github.com/YA-CIAO-LIANG/listenloop

## 給 Claude 的工作規則

- 我是 vibe coding 初學者，但要求商業專案等級的品質。每個 PR 的說明用繁體中文寫清楚：做了什麼、為什麼這是業界做法、怎麼測試。
- **自主進行**（2026-10-30 起）：依 `docs/roadmap.md` 的順序（a → f）一項一項做，不需要等我說「開始」或「合併」。
  1. 在分支上開發。main 受保護，必須透過 PR 且 CI 通過。
  2. 每項開 PR；大的項目拆成幾個 PR，依序做。
  3. 本機五項檢查（lint、format:check、typecheck、test、build）都通過，並用 production 模式檢查後再推送。
  4. CI 全部通過後，用 squash 合併並刪除分支，合併時用 `--match-head-commit`。
  5. 同步 main（切回 main、pull），刪除本機分支，更新 `docs/roadmap.md` 的進度，接著做下一項。
- 規格沒有定義的細節：自行選擇合理的業界預設，記在 `docs/decisions.md`，不要停下來問我。內容包括日期、決定、理由，以及要改時看哪裡。
- 只有需要我本人操作時才停下來，例如建立帳號或專案、申請憑證、提供 API 金鑰、同意需要信用卡的服務。需要我做的事要一次整理成清單、附上詳細步驟，並同步更新 `docs/roadmap.md` 的「需要 Joe 操作的事」。
- 每完成一個里程碑（roadmap 的一個字母），給我簡短摘要和正式網站的測試重點。
- 內容工作（字幕記錄、時間點校正、NASA 影片）暫停，等 roadmap 的功能都完成後一次處理。
- 對話很長時，在里程碑之間開新對話。進度以 CLAUDE.md 和 `docs/roadmap.md` 為準。
- 不要自行新增付費服務或需要信用卡的服務，這類服務要經過我在清單中明確同意。新套件只在必要時加入，挑選官方或維護良好的套件，並把理由記在 `docs/decisions.md`。
- UI 一律遵守 `docs/design-system.md`，只使用其中定義的 tokens 與元件。規格未定義的部分自行決定，並補進 `docs/design-system.md`、記在 `docs/decisions.md`。
- 介面文字一律從翻譯檔讀取，元件內不可寫死任何中文或英文介面文字。
- 程式碼與註解用英文；跟我溝通用繁體中文。

## 產品目標

使用者選一份英文聽力素材，進行 7 天的循環練習，訓練「聽清楚每個字」的確定感。

- **內建內容庫**：公有領域或 CC BY 素材（Blender 開放電影、VOA Learning English、美國國務院 Everyday Conversations 等），一律標示出處；排除 AP、Reuters、AFP 等通訊社素材。
- **帳號與雲端進度**：Google 登入，進度存在雲端，可以刪除帳號。
- **同時練習多部影片**：每支影片各自有 7 天循環與起始日。
- **自建練習**：上傳中文或英文文字檔，用聲音 API 產生音檔；可以整理成 Collection 與筆記本，設為公開或私人。
- **公開分享**：瀏覽他人公開的練習，可以檢舉，管理員可以下架。
- **先專心做功能**：付費方案、金流、上架 Google Play 之後再做。網頁版先上線（Vercel），之後以 PWA 打包上架。

產品定位：不是工具，而是有節奏的課程；重點是「看得見的進步」。
目標使用者：台灣學生（含留學生）。

### 架構要求：方案限制與付費 API

- **方案限制**（同時練習數、每月建立數、每篇字數）寫成集中的權限設定，程式只透過它判斷能不能做；目前全部不限制，未來收費時只改設定，不改功能程式碼。
- **聲音 API 與 AI 翻譯**：付費功能上線前只開放給管理員帳號（我）。在伺服器端呼叫，API key 只放環境變數；設每日用量上限與費用警示。
- **相同文字＋相同聲音只產生一次**：用內容雜湊快取，重複建立時直接沿用。
- 外部服務：Supabase、Google 登入、聲音 API 和翻譯 API 已列入 `docs/roadmap.md`（2026-10-30）。需要信用卡的服務（例如 Google Cloud 帳單），要我在清單中明確同意才導入。

## 週循環規則

- **Day 1 精聽聽寫**：逐句播放影片原音，使用者打字，逐字比對算正確率。完成後可查看雙語講義（英中對照＋單字＋文法），可輸出 PDF；講義在第 1 天完成前不開放，避免先看原文。支援單句重播。
- **Day 2～6 跟讀**：逐句播放後使用者跟念，語音辨識判斷是否念完、念對哪些字。每天需完成全部句子。
- **Day 7 重新聽寫**：同一支影片完整聽寫一次，並與 Day 1 對比顯示進步。
- **週結算**：Day 7 正確率 ≥ 80% → 通過；< 80% → 同一支影片重新一週。完成 Day 7 時自動結算。沒通過時，新的一週在 Day 7 之後的日曆日才能開始（測試模式可略過）；通過後引導選下一支影片，各天仍可回看與重練（不影響成績）。
- **重練**：當天任務完成後可以再練一次。正式成績以第一次完成為準；重練只顯示該次分數，不儲存、不影響正式成績與週結算（避免 Day 7 重做刷過 80%）。
- 每一天需完成前一天，且在不同日曆日才解鎖（`NEXT_PUBLIC_DEV_TEST_MODE=true` 時可略過日期限制）。已完成的天數可隨時回看與重練；直接打開未解鎖的天數會顯示原因。

## 多語系（介面語言）

- 支援繁體中文（zh-Hant，預設）與英文（en）介面。
- 使用 `next-intl`，不使用網址語言前綴；語言選擇存在 cookie。
- 第一次造訪依瀏覽器語言判斷，之後依使用者選擇。
- 翻譯檔：`messages/zh-Hant.json`、`messages/en.json`，以功能分組（例如 `common`、`home`、`dictation`、`shadowing`、`handout`、`settings`）。
- 必須有測試確認兩份翻譯檔的 key 完全一致。
- `<html lang>` 跟著介面語言切換；英文練習內容永遠標 `lang="en"`。
- 介面語言只影響 UI 文字。講義翻譯目前固定為繁體中文（目標使用者為台灣學生；英文介面視為沉浸模式）。

## 技術選擇

- Next.js（App Router）+ TypeScript（strict）+ Tailwind CSS
- 多語系：next-intl
- YouTube IFrame Player API，依 start/end 時間戳逐句播放。不下載音檔。不提供速度切換。
  - 必須遵守 YouTube 條款：播放器至少 200×200 px、不可在播放器上加遮罩或任何覆蓋元素、不可隱藏畫面只播聲音、不可使用 API 文件沒有寫的功能（例如 `unloadModule`）。
  - 字幕：官方沒有可強制關閉的參數，字幕依使用者自己的偏好顯示。聽寫與跟讀頁面要提示使用者點播放器的 CC 按鈕關閉字幕（2026-10-26 決定，方案 A）。
- 跟讀：Web Speech API（en-US），建議 Chrome。
- 進度：MVP 用 localStorage，透過 `lib/storage` 抽象層存取；M4 搬到 Supabase（登入後把 localStorage 的進度搬到雲端）。
- PDF：列印專用 CSS ＋瀏覽器列印。
- 部署：Vercel（Hobby）；PWA：manifest ＋ service worker；Android：PWABuilder。

## 工程標準

- **專案結構**：`app/`（頁面）、`components/`（UI 元件）、`lib/`（純邏輯：評分、循環、儲存、語言偵測）、`i18n/`（next-intl 請求設定與切換語言的 Server Action；會讀寫 cookie，所以不放 `lib/`）、`messages/`（翻譯檔）、`data/videos/`（影片 JSON）、`scripts/`（預處理）、`docs/`（規格文件）、`tests/`。
- **品質工具**：ESLint ＋ Prettier；husky ＋ lint-staged 提交前自動檢查。
- **測試**：Vitest 單元測試，`lib/` 的評分與循環邏輯必須有測試；品質打磨階段以 Playwright 做主要流程的 E2E 測試。
- **Git**：分支命名 `feat/…`、`fix/…`、`chore/…`、`docs/…`、`content/…`（新增或修改影片內容）；commit 用 Conventional Commits。所有 PR 在 CI 通過後直接合併（2026-10-30 起，見工作規則）。
- **CI**：GitHub Actions job 名稱為 `check`（分支保護依此名稱，不可任意更改），執行 lint、format:check、typecheck、test、build。
- **秘密資訊**：API key 只放 `.env.local`，必須在 `.gitignore`；`.env.example` 提供範本。
- **無障礙與錯誤處理**：見 `docs/design-system.md`；麥克風權限被拒、瀏覽器不支援語音辨識、影片無法載入，都要有友善提示。

## 設計系統

完整規格見 `docs/design-system.md`（風格：沉靜、專業、黑白橘；支援深色模式）。

## 資料格式

影片：`/data/videos/<id>.json`，並在 `data/videos/index.ts` 登記（測試會檢查每個 JSON 都有登記；build 時驗證格式）。

```json
{
  "id": "sintel",
  "youtubeId": "xxxxxxxxxxx",
  "title": "...",
  "level": "beginner | intermediate | advanced",
  "category": "daily | campus | business | interview | story",
  "collection": "blender-open-movies",
  "source": "Blender Foundation",
  "attribution": {
    "credit": "© copyright Blender Foundation | durian.blender.org",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0/",
    "sourceUrl": "https://durian.blender.org/sharing/",
    "transcriptUrl": "https://.../sintel_en.srt",
    "changes": "Excerpt (1:47–2:36); Chinese translation, vocabulary, and grammar notes added by ListenLoop"
  },
  "sentences": [{ "i": 0, "start": 1.2, "end": 4.8, "en": "...", "zh": "..." }],
  "vocab": [
    { "sentence": 0, "word": "...", "pos": "n.", "zh": "...", "example": "..." }
  ],
  "grammar": [
    { "sentence": 0, "point": "...", "explanation": "...", "example": "..." }
  ]
}
```

- 片段長度：第一句 `start` 到最後一句 `end`（四捨五入到秒，不含播放緩衝），由 `lib/excerpt-length.ts` 的 `excerptSeconds` 自動計算，不手動填寫。正式影片至少 1 分鐘（驗證會擋；草稿不檢查）。題庫的長度篩選區間集中在同一個檔案的 `LENGTH_BUCKETS`（1～2、2～3…7～8 分鐘、8 分鐘以上；含下限、不含上限）。
- `collection` 必填：題庫依合集分組顯示。合集 id 與顯示順序在 `lib/videos.ts` 的 `videoCollections`，名稱與說明放在翻譯檔 `collections.<id>.title`、`.intro`（測試檢查兩種語言都有）。目前只有 `blender-open-movies`（「Blender 開放電影」／「Blender Open Movies」）。
- `attribution` 必填，播放頁一律顯示出處。`license` 只能是 `Public Domain`、`CC BY x.x` 或 `CC BY-SA x.x`（NC、ND 會被驗證擋下）。授權規則與候選影片見 `docs/video-candidates.md`。
- 內建內容庫：英文句子與時間點取自官方逐字稿或字幕；中文翻譯、單字、文法手寫（不接付費 API），App 執行時不呼叫 AI。使用者自建練習（M6）只在建立時呼叫翻譯與聲音 API，練習時不呼叫。
- `vocab`、`grammar` 每一筆的 `sentence` 是出處句子的索引（對應 `sentences[].i`，必填）。聽寫每句答完後，顯示這句的中文與對應的單字、文法。
- 製作流程（查證 → 句子 → 草稿 → 翻譯講解 → 校正時間點 → 上架）見 `docs/content-workflow.md`。草稿用 `npm run video:new -- meta.json sentences.txt` 產生。
- `draft: true`（選填）：製作中的影片，不出現在影片庫，影片頁與練習頁回 404，只有 `/videos/<id>/timing` 打得開；草稿的中文可以是「（待翻譯）」、單字與文法可以是空的，正式影片不行（驗證會擋）。
- 時間點用 `/videos/<id>/timing`（不列入導覽、不被搜尋）：先用「點按模式」邊播邊按空白鍵標出每句開頭，再逐句播放微調，最後複製 JSON 回填。
- 播放時自動加前後緩衝：開始提早 0.15 秒、結束延後 0.25 秒，但不越過前一句的結束或下一句的開始（`lib/player/padding.ts`）。JSON 裡存的是原始時間點，不含緩衝。

進度（localStorage key：`ll-progress:v1:<videoId>`；型別與驗證見 `lib/progress.ts`）：

```json
{
  "videoId": "voa-001",
  "week": 2,
  "startedAt": "2026-10-24",
  "days": {
    "1": {
      "done": true,
      "score": 0.72,
      "date": "2026-10-24",
      "answers": ["we moved to the city", null]
    },
    "2": {
      "done": false,
      "sentences": [
        { "done": true, "coverage": 0.9 },
        { "done": true, "coverage": null }
      ]
    }
  },
  "status": "in-progress | passed | repeat",
  "history": [
    {
      "week": 1,
      "startedAt": "2026-10-01",
      "day1Score": 0.6,
      "day7Score": 0.75,
      "passed": false
    }
  ]
}
```

- `date`：該天完成的當地日期（使用者裝置時區）。
- `answers`：聽寫（Day 1、7）每句第一次送出的答案，`null` 表示尚未作答；用於中途續做與 Day 1 / 7 逐句比較。
- `sentences`：跟讀（Day 2～6）每句狀態；`coverage: null` 表示無法使用語音辨識（瀏覽器不支援、麥克風被拒或找不到），使用者按「我念完了」自行標記完成。
- `history`：已結束的每一週成績；重來一週時保留。

獎勵（M2.5；規則見 `docs/aquarium.md`，數字集中在 `lib/rewards.ts`）：

- `ll-activity:v1`：`{ "days": { "2026-10-27": { "official": true, "retries": ["sintel"], "tasks": [{ "videoId": "sintel", "week": 1, "day": 3 }] } } }`。重練不寫進正式進度，所以在這裡記錄，用於重練點數與連續天數。`tasks` 是每天完成的正式任務（較晚加入，舊資料可能沒有），首頁練習日曆用它與進度裡的完成日期合併；重來一週清掉的各天紀錄仍保留在這裡。它是練習資料，正式任務完成時一律記錄，不受遊戲化開關影響。
- `ll-wallet:v1`：`{ "points": { "earned": [], "spent": [] }, "feed": { "earned": [], "used": [] } }`，每筆 `{ "id", "amount", "date" }`，只新增不修改。獎勵一律由紀錄推算、以唯一 ID 領取（例如 `day:sintel:w1:d3`、`feed:2026-10-27`），重複領取不會重複發；飼料最多存 7 份，存滿時那份記為 0、之後不補。`fish`（商店加入，舊帳本沒有）：`{ "owned": [{ "id": "clownfish:1", "species": "clownfish", "date" }], "inTank": ["clownfish:1"] }`；第一次使用送一隻水蝸牛（`snail:starter`），魚缸最多 12 隻；購買記在 `points.spent`（`buy:clownfish:1`），點數不退。

魚：`/data/fish/<id>.json`，並在 `data/fish/index.ts` 登記（測試檢查登記、格式、兩種語言都有魚名與介紹）。欄位：`id`、`price`（點數）。魚的外觀是程式繪製的像素畫（`lib/pixel-fish/`），沒有外部素材；魚名與介紹放在翻譯檔 `fish.<id>`。

## 評分邏輯

- 正規化：小寫、去標點、展開常見縮寫（don't → do not）、0～99 的數字轉成英文單字（5 → five）。所有格與 'd 因有歧義不展開。
- 對齊：逐字對齊，優先讓對到的字最多（依序寫對的每個字都得分），平手時才選編輯次數最少。
- 聽寫：正確率 = 對到字數 ÷ max(原句字數, 使用者輸入字數)。多寫的字會降低分數，避免亂打一長串常見字矇分；什麼都沒寫是 0。對錯字以顏色＋底線/刪除線標示。每句第一次送出即算分，不能重答。一天的正確率依字數加權：所有句子對到的字數 ÷ 每句 max(原句字數, 輸入字數) 的總和。
- 跟讀：涵蓋率 = 對到字數 ÷ 原句字數，≥ 70% 視為念完，標示漏念的字。多出的字不扣分，因為語音辨識常會多出雜字。

## 里程碑

- [x] **M0 專案地基**：Next.js 骨架、品質工具、測試、CI、分支保護、Vercel 部署
- [x] **M1 設計系統與多語系**：tokens、深色模式、字體、核心元件、next-intl、/styleguide
- [x] **M2 核心功能**：逐句播放 → 聽寫 → 講義＋PDF → 跟讀 → 7 天循環
- [ ] **M2.5 魚缸激勵系統**（**暫停，以功能開關關閉**：2026-10-28 使用者決定不走遊戲化方向。程式碼保留，`lib/features.ts` 的 `AQUARIUM_ENABLED = false` 關閉頁首點數與飼料、完成畫面的獲得提示、魚店與我的魚（`/shop` 回 404）、`/styleguide` 的像素魚區塊，也不再領取獎勵。日後要恢復時改成 `true`，詳見 `docs/aquarium.md`）：首頁背景是像素風魚缸，由程式用 Canvas 2D 繪製（魚種例如小丑魚、水蝸牛、大白鯊、鯨鯊）。魚的風格是「寫實配色＋大眼萌系」：花紋、配色、光影寫實；眼睛超大（約頭高 1/3）、一大一小兩個反光點、身體稍圓稍短；會隨機眨眼、看向游標或飼料、吃飽時 ^ ^、飢餓時眼皮半閉（reduced motion 時只保留靜態表情）；尾巴 2～4 格擺動加身體起伏與轉身。所有魚種都照 `docs/aquarium.md` 第 1a 節的規則畫。只用點數與飼料，不涉及真錢。設計與規則見 `docs/aquarium.md`。
  - **點數**：練習獲得，只用來在購魚商店買魚；頁首顯示目前點數。
  - **飼料**（和點數分開計算）：每天完成任務獲得 1 份。在首頁點魚缸水面撒飼料，飼料緩慢下沉，魚游過去吃；另有「餵魚」按鈕給鍵盤與螢幕閱讀器使用。首頁日曆的魚飼料圖示代表那天有餵魚。
  - **飢餓（溫和、不懲罰）**：超過 1 天沒餵，魚游得較慢、偏向缸底；餵食後立即恢復。魚不會死亡或消失。
  - **互動**：點魚會轉身、吐泡泡並顯示名字；點玻璃附近的魚會散開；游標或手指移動時魚會好奇靠近。reduced motion 時只顯示名字、不播動畫。
  - **PR 拆法**：a 點數與飼料的獲得、帳本；b 商店、我的魚、素材出處頁（影片）；b2 像素小丑魚樣板（`/styleguide`，確認風格後才做其他魚種）；b3 其他魚種與商店像素縮圖；c 像素風魚缸、餵魚、飢餓、日曆、互動。
  - 魚、魚缸、飼料都由程式繪製，不使用第三方素材；若日後使用外部素材，只能用 CC0、CC BY，授權在官方頁面確認並在 `/credits` 標示出處。
- [ ] **M3 內容庫**：先只做「Blender 開放電影」合集（只收 CC BY；Sintel、Tears of Steel、Elephants Dream、Cosmos Laundromat、Sprite Fright，一部切成多段，預估 13 支），標示出處。VOA Learning English、美國國務院 Everyday Conversations **暫停**（資料保留在 `docs/video-candidates.md`）。句子一律取自和影片同一來源的字幕（VOA 2016 年舊版逐字稿曾與 YouTube 影片對不上，2026-10-28，PR #28 關閉）。已完成：內容工具、讀取 `.srt`。全片清單、段落與難度見 `docs/video-candidates.md`。
      剩下的里程碑（roadmap a～f）的順序、PR 拆法和進度見 `docs/roadmap.md`；內容工作（M3 剩下的部分）暫停，等功能完成後再做。

- [ ] **M4 帳號**（roadmap b）：Supabase、Google 登入、localStorage 進度搬到雲端、刪除帳號功能、隱私權政策（Google 登入需要）。
- [ ] **M5 同時練習多部影片**（roadmap c）：每支影片各自的 7 天循環與起始日。
- [ ] **M6 建立練習**（roadmap d）：上傳中文或英文文字檔建立練習（中文先翻成英文）；聲音 API 可選男聲、女聲與美、英、澳、印口音；Collection 與筆記本；可設公開或私人；相同文字加相同聲音只產生一次。
- [ ] **M7 公開分享**（roadmap e）：瀏覽他人公開的練習、檢舉與下架。
- [ ] **之後**：品質打磨（E2E 測試、無障礙、效能、錯誤處理）與 Beta 試用；付費方案、金流；PWA → PWABuilder → Google Play 上架。
