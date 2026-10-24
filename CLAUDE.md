# ListenLoop — 週循環英語聽力練習 App

## 給 Claude 的工作規則
- 我是 vibe coding 初學者，但要求商業專案等級的品質。每次改動前先用繁體中文說明要做什麼、為什麼這是業界做法。
- 一次只做一個功能或一個 issue。完成後說明怎麼測試，等我確認再繼續。
- 一律在 feature 分支上開發，不直接改 main。完成後提醒我開 Pull Request。
- 不要自行新增付費服務、需要信用卡的服務，或未經我同意的新套件。
- UI 一律使用「設計系統」章節定義的 tokens 與元件，不要自己發明顏色、字體或間距。設計系統未定義的部分先問我。
- 程式碼與註解用英文；跟我溝通用繁體中文。
- 不確定需求時先問，不要猜。

## 產品目標
使用者選一支英文影片，進行 7 天的循環練習，訓練「聽清楚每個字」的確定感。
先用內建影片庫（20～30 支），流程穩定後才開放使用者貼自己的 YouTube 連結。
網頁版先上線（Vercel），再以 PWA 打包上架 Google Play。
產品定位：不是工具，而是有節奏的課程；重點是「看得見的進步」。

## 週循環規則
- **Day 1 精聽聽寫**：逐句播放影片原音，使用者打字，逐字比對算正確率。可查看雙語講義（英中對照＋單字＋文法），可輸出 PDF。支援單句重播、0.75x / 0.5x 速度。
- **Day 2～6 跟讀**：逐句播放後使用者跟念，語音辨識判斷是否念完、念對哪些字。每天需完成全部句子。
- **Day 7 重新聽寫**：同一支影片完整聽寫一次，並與 Day 1 對比顯示進步。
- **週結算**：Day 7 正確率 ≥ 80% → 通過；< 80% → 同一支影片重新一週。
- 每一天需完成前一天，且在不同日曆日才解鎖（開發用測試模式可略過）。

## 技術選擇
- Next.js（App Router）+ TypeScript（strict）+ Tailwind CSS
- YouTube IFrame Player API，依 start/end 時間戳逐句播放。不下載音檔。
- 跟讀：Web Speech API（en-US），建議 Chrome。
- 進度：MVP 用 localStorage，透過 `lib/storage` 抽象層存取，未來可換成 Supabase。
- PDF：列印專用 CSS ＋瀏覽器列印，中文用 Noto Sans TC。
- 部署：Vercel；PWA：manifest ＋ service worker；Android：PWABuilder。

## 工程標準
- **專案結構**：`app/`（頁面）、`components/`（UI 元件）、`lib/`（純邏輯：評分、循環、儲存）、`data/videos/`（影片 JSON）、`scripts/`（預處理）、`tests/`。
- **品質工具**：ESLint ＋ Prettier；提交前自動檢查（husky ＋ lint-staged）。
- **測試**：Vitest 單元測試，`lib/` 的評分與循環邏輯必須有測試；之後以 Playwright 做主要流程的 E2E 測試。
- **Git**：分支命名 `feat/…`、`fix/…`、`chore/…`；commit 用 Conventional Commits（`feat: add dictation scoring`）。
- **CI**：GitHub Actions 在每個 PR 執行 lint、type check、test、build，全過才能合併。
- **秘密資訊**：API key 只放 `.env.local`，必須在 `.gitignore`；提供 `.env.example`。
- **無障礙**：可用鍵盤操作、按鈕有 label、文字對比度符合 WCAG AA。
- **錯誤處理**：麥克風權限被拒、瀏覽器不支援語音辨識、影片無法載入，都要有友善提示。

## 設計系統（由 Joe 定義，未填前用中性預設值並標註 TODO）
- 風格關鍵字：TODO
- 色彩 tokens：primary / secondary / background / surface / text / muted / success / error：TODO
- 字體：英文 TODO、中文 TODO
- 圓角、陰影、間距尺度：TODO
- 核心元件：Button、Card、ProgressBar、SentenceRow、DayTracker、ScoreBadge

## 資料格式
影片：`/data/videos/<id>.json`
```json
{
  "id": "voa-001",
  "youtubeId": "xxxxxxxxxxx",
  "title": "...",
  "level": "beginner | intermediate | advanced",
  "category": "daily | campus | business | interview",
  "source": "VOA Learning English",
  "license": "public domain",
  "sentences": [{ "i": 0, "start": 1.2, "end": 4.8, "en": "...", "zh": "..." }],
  "vocab": [{ "word": "...", "pos": "n.", "zh": "...", "example": "..." }],
  "grammar": [{ "point": "...", "explanation": "...", "example": "..." }]
}
```
進度：
```json
{
  "videoId": "voa-001",
  "week": 1,
  "startedAt": "2026-10-24",
  "days": { "1": { "done": true, "score": 0.72, "date": "..." } },
  "status": "in-progress | passed | repeat"
}
```

## 評分邏輯
- 正規化：小寫、去標點、展開常見縮寫（don't → do not）。
- 聽寫：逐字對齊（Levenshtein），正確率 = 對到字數 / 原句字數，對錯字以顏色標示。
- 跟讀：辨識結果涵蓋率 ≥ 70% 視為念完，標示漏念的字。

## 里程碑
- **M0 專案地基**：Next.js 骨架、品質工具、測試框架、CI、GitHub 流程、Vercel 部署
- **M1 設計系統**：依 Joe 的風格建立 tokens 與核心元件
- **M2 核心功能**：逐句播放 → 聽寫 → 講義＋PDF → 跟讀 → 7 天循環
- **M3 內容庫**：預處理腳本、20～30 支影片
- **M4 品質打磨**：E2E 測試、無障礙、效能、錯誤處理、隱私權政策
- **M5 Beta**：真實使用者試用一週並修正
- **M6 上架**：PWA → PWABuilder → Google Play 封閉測試 → 正式上線
