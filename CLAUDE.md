# ListenLoop — 週循環英語聽力練習 App

線上網址：https://listenloop-three.vercel.app
GitHub：https://github.com/YA-CIAO-LIANG/listenloop

## 給 Claude 的工作規則

- 我是 vibe coding 初學者，但要求商業專案等級的品質。每次改動前先用繁體中文說明要做什麼、為什麼這是業界做法。
- 先用 plan mode 列計畫，計畫被認可不等於可以執行：我說「開始」才動手。
- 一次只做一個功能或一個 issue。完成後說明怎麼測試，等我確認再繼續。
- 一律在分支上開發（main 受保護，必須透過 PR 且 CI 通過）。完成後開 PR，合併規則：
  - `docs/`、`fix/`、`chore/` 這類小改動：CI 全部通過後，Claude 直接用 squash 合併並刪除分支。
  - `feat/` 功能或 UI 改動：CI 通過後，Claude 給我摘要和 Vercel 預覽網址，我說「合併」才合併。
- 合併後一律同步 main（切回 main、pull）並刪除本機分支。
- 不要自行新增付費服務、需要信用卡的服務，或未經我同意的新套件。
- UI 一律遵守 `docs/design-system.md`，只使用其中定義的 tokens 與元件。規格未定義的部分先問我。
- 介面文字一律從翻譯檔讀取，元件內不可寫死任何中文或英文介面文字。
- 程式碼與註解用英文；跟我溝通用繁體中文。
- 不確定需求時先問，不要猜。

## 產品目標

使用者選一支英文影片，進行 7 天的循環練習，訓練「聽清楚每個字」的確定感。
先用內建影片庫（20～30 支），流程穩定後才開放使用者貼自己的 YouTube 連結。
網頁版先上線（Vercel），再以 PWA 打包上架 Google Play。
產品定位：不是工具，而是有節奏的課程；重點是「看得見的進步」。
目標使用者：台灣學生（含留學生）。

## 週循環規則

- **Day 1 精聽聽寫**：逐句播放影片原音，使用者打字，逐字比對算正確率。完成後可查看雙語講義（英中對照＋單字＋文法），可輸出 PDF；講義在第 1 天完成前不開放，避免先看原文。支援單句重播。
- **Day 2～6 跟讀**：逐句播放後使用者跟念，語音辨識判斷是否念完、念對哪些字。每天需完成全部句子。
- **Day 7 重新聽寫**：同一支影片完整聽寫一次，並與 Day 1 對比顯示進步。
- **週結算**：Day 7 正確率 ≥ 80% → 通過；< 80% → 同一支影片重新一週。
- **重練**：當天任務完成後可以再練一次。正式成績以第一次完成為準；重練只顯示該次分數，不儲存、不影響正式成績與週結算（避免 Day 7 重做刷過 80%）。
- 每一天需完成前一天，且在不同日曆日才解鎖（`NEXT_PUBLIC_DEV_TEST_MODE=true` 時可略過）。

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
- 進度：MVP 用 localStorage，透過 `lib/storage` 抽象層存取，未來可換成 Supabase。
- PDF：列印專用 CSS ＋瀏覽器列印。
- 部署：Vercel（Hobby）；PWA：manifest ＋ service worker；Android：PWABuilder。

## 工程標準

- **專案結構**：`app/`（頁面）、`components/`（UI 元件）、`lib/`（純邏輯：評分、循環、儲存、語言偵測）、`i18n/`（next-intl 請求設定與切換語言的 Server Action；會讀寫 cookie，所以不放 `lib/`）、`messages/`（翻譯檔）、`data/videos/`（影片 JSON）、`scripts/`（預處理）、`docs/`（規格文件）、`tests/`。
- **品質工具**：ESLint ＋ Prettier；husky ＋ lint-staged 提交前自動檢查。
- **測試**：Vitest 單元測試，`lib/` 的評分與循環邏輯必須有測試；M4 以 Playwright 做主要流程的 E2E 測試。
- **Git**：分支命名 `feat/…`、`fix/…`、`chore/…`、`docs/…`；commit 用 Conventional Commits。
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

- `attribution` 必填，播放頁一律顯示出處。`license` 只能是 `Public Domain`、`CC BY x.x` 或 `CC BY-SA x.x`（NC、ND 會被驗證擋下）。授權規則與候選影片見 `docs/video-candidates.md`。
- 英文句子與時間點取自官方逐字稿或字幕；中文翻譯、單字、文法手寫（不接付費 API），App 執行時不呼叫 AI。
- `vocab`、`grammar` 每一筆的 `sentence` 是出處句子的索引（對應 `sentences[].i`，必填）。聽寫每句答完後，顯示這句的中文與對應的單字、文法。
- 時間點用 `/videos/<id>/timing`（不列入導覽、不被搜尋）逐句播放微調，再複製 JSON 回填。
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

## 評分邏輯

- 正規化：小寫、去標點、展開常見縮寫（don't → do not）、0～99 的數字轉成英文單字（5 → five）。所有格與 'd 因有歧義不展開。
- 對齊：逐字對齊，優先讓對到的字最多（依序寫對的每個字都得分），平手時才選編輯次數最少。
- 聽寫：正確率 = 對到字數 ÷ max(原句字數, 使用者輸入字數)。多寫的字會降低分數，避免亂打一長串常見字矇分；什麼都沒寫是 0。對錯字以顏色＋底線/刪除線標示。每句第一次送出即算分，不能重答。一天的正確率依字數加權：所有句子對到的字數 ÷ 每句 max(原句字數, 輸入字數) 的總和。
- 跟讀：涵蓋率 = 對到字數 ÷ 原句字數，≥ 70% 視為念完，標示漏念的字。多出的字不扣分，因為語音辨識常會多出雜字。

## 里程碑

- [x] **M0 專案地基**：Next.js 骨架、品質工具、測試、CI、分支保護、Vercel 部署
- [ ] **M1 設計系統與多語系**：tokens、深色模式、字體、核心元件、next-intl、/styleguide
- [ ] **M2 核心功能**：逐句播放 → 聽寫 → 講義＋PDF → 跟讀 → 7 天循環
- [ ] **M3 內容庫**：預處理腳本、20～30 支影片
- [ ] **M4 品質打磨**：E2E 測試、無障礙、效能、錯誤處理、隱私權政策
- [ ] **M5 Beta**：真實使用者試用一週並修正
- [ ] **M6 上架**：PWA → PWABuilder → Google Play 封閉測試 → 正式上線
