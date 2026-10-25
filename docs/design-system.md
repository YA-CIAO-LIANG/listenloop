# ListenLoop Design System

風格關鍵字：沉靜、專業、黑白橘。
骨架：大字留白、細線分隔、襯線標題＋無襯線內文。強調來自字級對比，而不是裝飾。

## 色彩 tokens

所有顏色都以 CSS 變數定義，元件只能使用變數，不可寫死色碼。

| Token             | Light   | Dark    | 用途                               |
| ----------------- | ------- | ------- | ---------------------------------- |
| `--ll-ground`     | #FAFAF8 | #121212 | 頁面背景                           |
| `--ll-surface`    | #FFFFFF | #1C1C1C | 少數面板、講義紙面                 |
| `--ll-band`       | #F2F1ED | #181818 | 區塊交替的淡色帶                   |
| `--ll-ink`        | #141414 | #F2F2F0 | 標題與主要文字                     |
| `--ll-ink-muted`  | #5C5C5C | #A3A3A0 | 次要資訊                           |
| `--ll-accent`     | #E8590C | #FF7A33 | 橘：細線、進度條、按鈕底色、小點綴 |
| `--ll-accent-ink` | #B8440A | #FF8F52 | 橘色文字（符合 AA 對比）           |
| `--ll-line`       | #E5E3DE | #2E2E2E | 細分隔線、邊框                     |
| `--ll-success`    | #2F7D4F | #5CC28A | 聽寫答對的字                       |
| `--ll-error`      | #C2362B | #FF6B5E | 聽寫答錯、漏字                     |
| `--ll-focus`      | #E8590C | #FF7A33 | 鍵盤焦點外框                       |

規則：

- 亮橘 `--ll-accent` 不可當一般文字顏色，文字一律用 `--ll-accent-ink`。
- 答對/答錯不可只靠顏色區分，需搭配底線或刪除線（色盲友善）。
- 橘色是點綴，不是主色塊。整體畫面以黑白為主。

## 深色模式

- 預設跟隨系統（`prefers-color-scheme`），並提供手動切換：系統 / 淺色 / 深色。
- 手動選擇存在 localStorage，頁面載入前就套用，避免閃一下白畫面。
- 實作方式：`<html data-theme="light|dark">` 覆寫變數。

## 字體

| 角色    | 英文                            | 中文          | 用途                               |
| ------- | ------------------------------- | ------------- | ---------------------------------- |
| Display | EB Garamond（regular / italic） | Noto Serif TC | 大標題、分數數字、引言             |
| Reading | Instrument Sans                 | Noto Sans TC  | 內文、練習句子、輸入框、按鈕、導覽 |

- 以 `next/font/google` 載入，`display: swap`。
- 襯線字只用 regular，不加粗。
- 練習用的英文句子使用 Reading 字體，字級較大（18～20px），確保清楚易讀。
- 小標籤可用 12px、全大寫、字距加寬。
- 內文行高 1.65，閱讀寬度控制在約 65 字元內。

字級：

- Hero：clamp(44px, 8vw, 96px)，行高 1.05，字距略緊
- H1 40px / H2 28px / H3 20px（Display）
- Body 16px、Supporting 15px、Metadata 12px（Reading）

## 間距、圓角、線條

- 間距尺度：4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 px
- 控制項間距：24px
- 圓角：4px（幾乎方正，不使用膠囊形狀）
- 線條：1px 細線

## 按鈕（半透明）

所有按鈕共用一個 `Button` 元件，三種變體：

| 變體      | 背景              | 邊框            | 文字       |
| --------- | ----------------- | --------------- | ---------- |
| primary   | accent 透明度 14% | accent 實線 1px | accent-ink |
| secondary | ink 透明度 4%     | line 1px        | ink        |
| ghost     | 透明              | 無              | ink-muted  |

- 背景加 `backdrop-filter: blur(8px)`，蓋在內容上時有毛玻璃感。
- Hover：背景透明度提高（primary 14% → 22%），只變色不位移。
- Disabled：整體透明度 40%，游標 not-allowed。
- 尺寸：sm 32px / md 40px / lg 48px 高。手機上主要按鈕至少 44px，好點擊。
- 標籤可帶一個小方向箭頭（→）。

## 點擊動畫

所有可點擊元素（按鈕、可點的卡片、句子列）都有：

1. **按壓**：按下時 `transform: scale(0.97)`，放開回彈，120ms ease-out。
2. **漣漪**：從點擊位置擴散一圈 accent 透明度 25% 的圓，400ms 淡出。

- 使用 transform 與 opacity，不影響版面配置。
- `prefers-reduced-motion: reduce` 時關閉縮放與漣漪，只保留顏色變化。
- 鍵盤操作（Enter / Space）也要觸發按壓效果，漣漪從按鈕中心出發。

## 動態原則

- 互動過場：160ms。
- 標題、區塊、圖片保持靜止，不做進場動畫。
- 進度條數值變化可用 300ms 平滑過渡。

## 版面

- 大量留白，內容寬度上限約 1080px。
- 長區塊：左側標題、右側內容；760px 以下改為上下堆疊。
- 區塊交替使用 ground 與 band 背景。
- 多數內容直接放在頁面上，不要每段都包卡片。

## 無障礙

- 所有互動元素可鍵盤操作，焦點外框 2px `--ll-focus`，偏移 2px。
- 文字對比符合 WCAG AA。
- `<html lang>` 跟著介面語言（`zh-Hant` 或 `en`）；英文練習內容的元素永遠加 `lang="en"`。
- 圖示按鈕需有 aria-label，且 aria-label 也要從翻譯檔讀取。

## 多語系介面

- 支援繁體中文（預設）與英文介面，使用者可隨時切換。
- 切換入口：LanguageToggle 與 ThemeToggle 並排，放在頁首右側與設定頁。
- LanguageToggle 顯示「中文 / EN」兩個選項，目前語言以 accent-ink 文字＋底線標示，不只靠顏色。
- 切換語言時版面不可跳動：按鈕、標籤要預留足夠寬度，英文通常比中文長 30～50%。
- 字體依語言套用：中文介面以 Noto Sans TC / Noto Serif TC 為主；英文介面以 Instrument Sans / EB Garamond 為主。
- 數字、日期、百分比依介面語言格式化（例如「第 3 天」/「Day 3」）。
- 文案語氣：中文簡潔溫和；英文簡短直接。避免直譯。

## 核心元件清單

Button、Card、ProgressBar、SentenceRow、DayTracker（7 天進度）、ScoreBadge、ThemeToggle、LanguageToggle、Divider。

## 設計系統展示頁

`/styleguide` 頁面列出所有色票（兩種模式）、字級、按鈕變體與狀態、核心元件，並可切換語言檢查中英文版面，作為活的設計文件。正式上線前從導覽中隱藏。
