# ListenLoop Design System

風格關鍵字：沉靜、專業、黑白橘。
骨架：大字留白、細線分隔、襯線標題＋無襯線內文。強調來自字級對比，而不是裝飾。

## 色彩 tokens

所有顏色都以 CSS 變數定義，元件只能使用變數，不可寫死色碼。

| Token                  | Light                                           | Dark                                            | 用途                                                                                          |
| ---------------------- | ----------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `--ll-ground`          | #FAFAF8                                         | #121212                                         | 頁面背景                                                                                      |
| `--ll-surface`         | #FFFFFF                                         | #1C1C1C                                         | 少數面板、講義紙面                                                                            |
| `--ll-band`            | #F2F1ED                                         | #181818                                         | 區塊交替的淡色帶                                                                              |
| `--ll-ink`             | #141414                                         | #F2F2F0                                         | 標題與主要文字                                                                                |
| `--ll-ink-muted`       | #5C5C5C                                         | #A3A3A0                                         | 次要資訊                                                                                      |
| `--ll-accent`          | #E8590C                                         | #FF7A33                                         | 橘：細線、進度條、按鈕底色、小點綴                                                            |
| `--ll-accent-ink`      | #A63D09（2026-11-07 前是 #B8440A，D61）         | #FF8F52                                         | 橘色文字（符合 AA 對比）                                                                      |
| `--ll-line`            | #E5E3DE                                         | #2E2E2E                                         | 細分隔線、邊框                                                                                |
| `--ll-success`         | #256B40（2026-11-12 前是 #2D784C，D121）        | #5CC28A                                         | 聽寫答對的字                                                                                  |
| `--ll-error`           | #B3302A（2026-11-07 前是 #C2362B，D61）         | #FF6B5E                                         | 聽寫答錯、漏字                                                                                |
| `--ll-focus`           | #E8590C                                         | #FF7A33                                         | 鍵盤焦點外框                                                                                  |
| `--ll-heat-0`～`4`     | #EBE9E4 / #F6D2BD / #F1AA82 / #EC8147 / #E8590C | #262626 / #4D2C1A / #884622 / #C4602B / #FF7A33 | 練習日曆熱度圖：當天完成 0、1、2、3、4 個以上的正式任務（橘色與背景混合 25%／50%／75%／100%） |
| `--ll-heat-ink-strong` | #141414                                         | #121212                                         | 熱度第 3、4 階上的日期數字（深色模式的亮橘配淺色字不足 AA）                                   |

規則：

- 亮橘 `--ll-accent` 不可當一般文字顏色，文字一律用 `--ll-accent-ink`。
- 答對/答錯不可只靠顏色區分，需搭配底線或刪除線（色盲友善）。
- 橘色是點綴，不是主色塊。整體畫面以黑白為主。例外：練習日曆的熱度色階（資料視覺化）。
- 熱度格上的日期數字：第 0 階 ink-muted、第 1～2 階 ink、第 3～4 階 heat-ink-strong；每一階都符合 AA（淺色 ≥ 5.15，深色 ≥ 4.51）。

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

所有按鈕共用一個 `Button` 元件，四種變體：

| 變體      | 背景              | 邊框            | 文字       |
| --------- | ----------------- | --------------- | ---------- |
| primary   | accent 透明度 14% | accent 實線 1px | accent-ink |
| secondary | ink 透明度 4%     | line 1px        | ink        |
| ghost     | 透明              | 無              | ink-muted  |
| danger    | error 透明度 10%  | error 實線 1px  | error      |

- 背景加 `backdrop-filter: blur(8px)`，蓋在內容上時有毛玻璃感。
- Hover：背景透明度提高（primary 14% → 22%、danger 10% → 18%），只變色不位移。
- danger 只用於無法復原的操作（例如刪除帳號），而且一定要先確認。
- Disabled：整體透明度 40%，游標 not-allowed。
- 尺寸：sm 32px / md 40px / lg 48px 高。手機上主要按鈕至少 44px，好點擊。
- 標籤可帶一個小方向箭頭（→）。

## 點擊範圍 `tap`（D76）

- 觸控裝置（`pointer: coarse`）上，所有可點的東西至少 44px 高；滑鼠操作時外觀不變。
- 按鈕和 FilterChip 本來就有 `pointer-coarse:min-h-11`；文字連結（頁首導覽、頁尾、每頁上方的「← 返回」）、`<summary>` 加上 `tap` 工具類別（觸控時 inline-flex、置中、最小 44px）；表單欄位與下拉選單加 `pointer-coarse:min-h-11`。
- 段落裡的行內連結不加（會撐開行高），靠周圍文字的行距。
- 檢查方式：375px、觸控模式掃描每一頁（點擊範圍、字級不小於 12px、沒有橫向捲動），2026-11-08 全部通過。

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
- 進度條動畫（2026-10-27 Joe 選定：方案 A 的小橘點＋方案 C 的完成打勾）：
  - 領頭小橘點：6px accent 圓點固定在已完成部分的最前端。每前進一步，圓點往上輕彈 3px 再落下（`ll-dot-hop`，300ms ease-out）。
  - 全部完成：標籤右側以描線方式畫出 14px 的 ✓（success 色，`ll-check-draw`，400ms ease-out）。不再另加放大或光環，避免慶祝效果過多。
  - 只在進度實際前進時播放；頁面剛出現時（例如中途回來從 5 / 12 繼續，或打開已完成的結果）不播放，直接顯示狀態。
  - 只動 transform；✓ 的描線使用 `stroke-dashoffset`（圖示很小，對效能沒有影響）。動畫元素皆為 `aria-hidden`，數值由 progressbar 的 aria 屬性提供。
  - `prefers-reduced-motion: reduce`：不彈跳、不描線（✓ 直接出現），填色與圓點位置也不做過渡，直接切換。
- 慶祝動畫只有一種：聽寫當句 100% 的「完美」彩帶（見聽寫畫面）。其他地方不加慶祝效果。

## 版面

- 大量留白，內容寬度上限約 1080px。
- 練習頁（聽寫、跟讀）的練習區寬度上限 720px（token `--container-practice`），置中，用 `practice-column` 工具類別。
- 斷點：`split` 47.5rem（760px，長區塊左右排列）、`wide` 64rem（1024px）。
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
- 窄螢幕（760px 以下）：頁首右側的語言、主題、帳號可以換行，中間不顯示直線分隔，改用 16px 間距；任何寬度都不能出現橫向捲動（320px 也一樣）。
- LanguageToggle 顯示「中文 / EN」兩個選項，目前語言以 accent-ink 文字＋底線標示，不只靠顏色。
- 切換語言時版面不可跳動：按鈕、標籤要預留足夠寬度，英文通常比中文長 30～50%。
- 字體依語言套用：中文介面以中文字體為主；英文介面以 Instrument Sans / EB Garamond 為主。
- 中文字體用系統內建字型（D87）：
  - Reading：蘋方（PingFang TC）→ Noto Sans CJK TC → Noto Sans TC → 微軟正黑體；
  - Display：宋體（Songti TC）→ Noto Serif CJK TC → Noto Serif TC → 新細明體。
  - Android 內建 Noto CJK，所以 Android 上看起來和原本的 Noto Sans／Serif TC 一樣；Apple 與 Windows 裝置會用各自的系統字型。
- 數字、日期、百分比依介面語言格式化（例如「第 3 天」/「Day 3」）。
- 文案語氣：中文簡潔溫和；英文簡短直接。避免直譯。

## 帳號（頁首）

- 只有設定了 Supabase 時才顯示（D2：不登入也能練習）。放在頁首右側，ThemeToggle 右邊，中間用 vertical Divider 隔開。
- **未登入**：ghost、sm 的「登入」按鈕，按下後直接前往 Google 登入。等待時改成「前往 Google…」，按鈕不能再按。登入後回到原本的頁面，網址參數也會保留。
- **已登入**：ghost、sm 的「帳號 ▾」按鈕，採用 disclosure 模式（`aria-expanded`、`aria-controls`），不是 ARIA menu。
  - 按下後，按鈕下方右側對齊彈出一個面板：surface 底、1px line 邊框、4px 圓角、寬 256px、內距 16px。
  - 面板由上到下是：supporting、ink-muted 的「已登入」→ 內文字級、ink 色的 email，太長時可以換行 → secondary、sm 的「登出」。
  - 按 Escape 會關閉面板，焦點回到按鈕；點面板外面也會關閉。
  - 登出失敗時，在面板裡顯示 error 色的提示（`role="alert"`）。
- **登入結果提示**（`SignInNotice`）：放在頁首正下方的整條區塊，band 底、下方 1px line 線，內容寬度和頁首一樣。
  - 失敗（`?signin=failed`）：error 色文字，`role="alert"`。
  - 取消（`?signin=cancelled`）：supporting、ink-muted，`role="status"`。
  - 兩種都要說明「進度仍然存在這台裝置上」，右側有 ghost、sm 的「關閉」。關閉時移除網址參數，不捲動頁面。

## 學習進度 `/practices`

- **入口**：頁首左側，品牌名右邊的 supporting、ink-muted 連結「學習進度」（2026-11-03 前叫「我的練習」，D26），hover 時變成 ink 並加底線。品牌名和這個連結一起包在 `nav`（「主要導覽」）裡；登入後另外會看到「我的教材」，樣式相同（D48；「筆記本」已從頁首拿掉）。管理員可以建立練習時，頁首右側最前面有 primary、sm 的 ButtonLink「＋ 建立練習」（`/materials/new`）。窄螢幕時左右兩組都換行，入口不收進選單。
- **頁面**：h1「學習進度」→ 說明（ink-muted）→ 結果提示列（supporting、`aria-live`，移除成功時 ink-muted，失敗時 error）→ 依狀態分組：「進行中」「等待重新開始」「已通過」。沒有影片的組別不顯示。
- **每組**：
  - Display h3 組名，同一行放 supporting、ink-muted 的「N 支」；
  - 下方是清單，上下各有 1px line 線，項目之間也用 1px line 分隔；
  - 每列：影片名（font-medium、`lang="en"`，連到影片頁；已下架的影片不加連結，顯示 ink-muted 的「（已下架的影片）」）→ 進度行（和題庫卡片共用 `ProgressLabel`）→ 右側 ghost、sm 的「移除…」。
- **移除確認**：
  - 按「移除…」後，在那一列下方展開確認區塊：error 色 1px 邊框、4px 圓角、內距 16px；
  - 內容是說明「各天的進度和成績會刪除，無法復原；練習日曆的紀錄會保留」，下方是 danger、sm 的「移除進度」和 ghost、sm 的「取消」；
  - 一次只會展開一列的確認區塊。
- **空狀態**：ink-muted 的「還沒有開始的練習。」，下方是連到 `/#library` 的「前往推薦練習 →」。
- **組內排序**：依影片名稱。

## 帳號頁 `/account`

- 只有設定了 Supabase 時才有這一頁（否則回 404），不被搜尋引擎收錄。入口在頁首帳號面板「登出」右側，是 supporting、accent-ink 的底線連結「帳號設定」。
- **已登入**：h1「帳號」→ supporting、ink-muted 的「已登入的 Google 帳號」→ email → 同步說明（supporting、ink-muted）→ 1px line 分隔線 → h2「刪除帳號」→ 說明 → danger 的「刪除帳號…」。
- **刪除確認**：
  - 按下「刪除帳號…」後，就地展開一個確認區塊：error 色 1px 邊框、4px 圓角、內距 24px；
  - 區塊內依序是：font-medium 的「確定要永久刪除帳號嗎？會刪除：」→ 三點清單（supporting、ink-muted），列出帳號、雲端進度、這台裝置的練習資料 → 勾選框「我了解刪除後無法復原。」→ 按鈕列：danger「永久刪除帳號」（勾選後才能按）和 ghost「取消」；
  - 刪除中，按鈕文字改成「刪除中…」，兩個按鈕都不能按；
  - 失敗時，用 error 色 `role="alert"` 說明原因，帳號和本機資料都保留。
- **刪除成功**：清除這台裝置上的練習資料（主題等偏好設定保留），然後回到 `/account?deleted=1`，以 success 色 `role="status"` 顯示「你的帳號……已經刪除」，下方是「回首頁 →」。
- **未登入**：ink-muted 的說明，提示用頁首的「登入」，下方是「回首頁 →」。
- 頁面最下方：supporting 字級的「隱私權政策」連結。

## 我的教材 `/materials` 與建立練習 `/materials/new`

- 入口是頁首「學習進度」右邊的「我的教材」，登入後就看得到（D48）。一般使用者看到 h1 和一張 surface 卡片「建立練習還沒開放」（h3 標題＋ink-muted 說明）；管理員看到完整內容（D21、D26）。
- **我的教材**：h1「我的教材」→ 說明 → primary 的「建立練習 →」（沒有接上供應者時，改成 supporting、ink-muted 的說明）→「你建立的練習」與「Collection」兩節（見下方「整理自建練習」）。
- **建立練習**：返回連結「← 我的教材」→ h1「建立練習」→ 說明 → 表單。建立後，提示下方有 accent-ink 底線連結「到我的教材查看 →」。舊網址 `/create` 永久轉址到這裡。
- **表單欄位**（這一頁首次使用，之後的表單沿用）：
  - 標籤在欄位上方，font-medium；說明文字在標籤下方，supporting、ink-muted，用 `aria-describedby` 連到欄位；
  - 欄位：surface 底、1px line 邊框、4px 圓角、內距 16px／12px，focus 時邊框變成 accent，並有既有的焦點外框；
  - 錯誤訊息放在按鈕列下方，supporting、error 色、`role="alert"`；成功訊息 success 色、`role="status"`。
  - **選擇檔案**：原生 file input 隱藏（`sr-only`），用外觀和 secondary、sm 按鈕相同的 label 觸發；鍵盤焦點落在 input 上時，label 顯示焦點外框。
- **文字來源**（e+ 5）：第一步最上方是 font-medium 的「文字來源」＋ SegmentedControl「貼上或上傳文字 / AI 生成」。
  - **AI 生成**：標題 →「類別與情境」原生 `<select>`（依類別 `<optgroup>`，樣式同表單欄位，寬度上限 448px）→「主題或關鍵字（選填）」欄位與說明 →「程度」「長度」「形式」三個 SegmentedControl（初級／中級／高級；約 1／3／5 分鐘；對話／獨白）→ supporting、ink-muted 的說明 → primary「生成文字 →」（生成中改成「生成中…」，欄位不能操作）。錯誤在按鈕下方（error 色、`role="alert"`）。
  - 生成完成後切回「貼上或上傳文字」，標題和文字框填入生成結果、原文語言設為英文，下方 ink-muted 提示「已生成……可以修改文字後再斷句並翻譯」。
- **第一步**：標題 → 文字內容（說明、選擇 .txt 檔、10 行高的文字框、metadata 字級的「字元數 / 上限」，超過時變成 error 色）→ 原文語言（SegmentedControl「英文 / 中文」，下方 supporting、ink-muted 說明翻譯方向）→ primary 的「斷句並翻譯 →」。處理中按鈕文字改成「斷句、翻譯中…」，欄位都不能操作。
- **第二步：預覽與修改**：標題欄位 → h2「預覽與修改」與說明、句數 → 句子清單（上下和句子之間 1px line 線）。每列：左側 metadata、ink-muted 的兩位數句號；中間英文文字框（sentence 字級、`lang="en"`）和中文文字框（supporting 字級，留空時 placeholder「留空會在建立時自動翻譯」）；文字框下方一排 ghost、sm 按鈕：「從游標處拆分」（英文框的游標在句子中間時才可以按）、「與下一句合併」（最後一句沒有）、「刪除」（e+ 4）。清單上方說明之後，有一行 supporting、ink-muted 的拆分說明，也是英文框的 `aria-describedby`。清單下方 secondary、sm 的「新增一句」，再下方 primary「建立練習」和 ghost「回上一步」（保留原本的文字）。
- **聲音**（預覽步驟，句子清單下方）：h3「聲音」→ 聲音選單 `VoiceMenu`（見下方）→ supporting、ink-muted 的說明。
- **等待進度**（e+ 2）：「斷句並翻譯」和「建立練習」按下後，按鈕下方顯示 `StageProgress`（寬度上限 384px，`role="status"`）：上方標籤是目前步驟（「斷句中…」「翻譯中 3/6 句」「產生講解 10/12 句」「產生音檔 4/12 句」），右側是整體百分比。百分比只由完成的句數計算，沒有計時器或假動畫：斷句是一次呼叫，完成前停在 0%；翻譯每 8 句一批；建立時講解（每 10 句一段）佔前一半、音檔佔後一半。進度條的動畫遵守 reduced motion。
- **產生講解與音檔**：按「建立練習」後先建立，再逐段產生講解，接著逐批產生音檔。全部完成時顯示 success 的「已建立……講解和音檔都完成了」；沒有完成時用 ink-muted 說明原因，並提示到「我的教材」繼續。下方有「到我的教材查看 →」。
- **你建立的練習**：1px line 分隔線 → h2 → 清單（標題 font-medium；下一行 supporting、ink-muted 的「N 句・中文原文・日期・英式女聲」；再下一行音檔狀態）。
  - 準備狀態：講解和音檔都完成時，supporting、success 的「✓ 講解和音檔都完成了」，右側是 primary、sm 的「開始練習 →」。沒完成時，ink-muted 的「講解還沒產生・音檔 3 / 12」，旁邊是 secondary、sm 的「繼續產生」；產生中改成 `StageProgress`（同上）。錯誤用 error 色 `role="alert"`。
  - 沒有練習時顯示 ink-muted 的「還沒有建立練習。」
- 寬度上限和練習區相同（720px）。

### 整理自建練習（`/materials`）

- **練習清單**：h2「你建立的練習」→ supporting、ink-muted 的公開說明 → 依 Collection 分組（Display h3 組名；還沒有 Collection 時不顯示組名），最後是「未分組」。
- **每個練習的操作列**（在音檔狀態下方）：
  - 「Collection」標籤（supporting、ink-muted）＋原生 `<select>`：高 32px（觸控至少 44px）、surface 底、1px line 邊框、4px 圓角、supporting 字級，第一個選項是「未分組」；
  - 「私人 / 公開」SegmentedControl（螢幕閱讀器讀「「標題」公開或私人」）；
  - ghost、sm 的「刪除練習…」→ 展開確認區塊（error 色 1px 邊框、4px 圓角、內距 16px），裡面是 danger、sm 的「永久刪除練習」和 ghost、sm 的「取消」。
- **Collection 一節**：h2 → 說明 → 「新的 Collection 名稱」欄位＋secondary 的「新增」→ 清單（上下和項目之間 1px line）。每列：名稱（font-medium）＋ supporting、ink-muted 的「N 個練習」，右側「私人 / 公開」、ghost、sm 的「重新命名」和「刪除…」。重新命名時名稱變成欄位，旁邊是 primary、sm 的「儲存」和 ghost、sm 的「取消」。刪除確認和刪除練習相同，說明「裡面的練習會保留」。
- 錯誤一律在該列下方，以 supporting、error 色、`role="alert"` 顯示。

### 編輯練習 `/materials/<id>/edit`（e+ 9c，D45）

- 入口：「我的教材」每個練習標題右邊，supporting、accent-ink 底線連結「編輯」（`aria-label`「編輯「標題」」）。
- 版面同建立練習：← 我的教材 → h1「編輯練習」→ ink-muted 說明 → 標題欄位 → h2「句子」（提示和句數）→ 句子清單 → h2「聲音」（VoiceMenu）→ 版本說明 → primary「儲存」＋ ghost 連結「取消」→ 進度條（StageProgress）→ 結果訊息。
- 每一列同建立時的檢查畫面：兩位數句號、英文和中文文字框；英文改過時下方顯示 supporting、accent-ink 的「英文改過了：儲存後會重新產生……」。
- 講解：每句一個收合的區塊（1px line 邊框、4px 圓角），摘要是「講解：單字 1、文法 0」，或「講解：儲存後重新產生」加上 ghost、sm 的「改成自己填寫」。展開後：
  - 「單字」小標籤（metadata、全大寫）：每個單字四個欄位（單字、詞性、中文、例句），760px 以上排成兩欄，加上 ghost、sm 的「刪除」；
  - 「文法」小標籤：句型、說明（文字框）、例句；
  - 「新增單字」「新增文法」在達到每句上限（2 個單字、1 個文法）時停用。
- 每列的按鈕（ghost、sm）：上移、下移、從游標處拆分、與下一句合併、刪除（只剩一句時停用）。
- 結果：成功是 success 色「已儲存新版本。打開練習 →」（`role="status"`）；失敗是 error 色（`role="alert"`），指出第幾句有問題，或請使用者重新整理（版本衝突）。

### 準備中的練習（D32）

- 自己的練習講解或音檔還沒完成時，練習總覽、第 1～7 天、講義頁不顯示 404，而是：返回連結「← 我的教材」→ h1 練習標題 → Display h3「這個練習還在準備中」→ ink-muted 說明 → `PracticeReadiness`（狀態列和「繼續產生」，規則同「我的教材」）。完成後頁面重新整理，直接進入原本要打開的頁面。

## 筆記本 `/notebooks`（已移除）

2026-11-07 依 Joe 的決定移除頁面、程式和資料表（D53）。

## 聲音練習面板（自建練習）

- 練習頁上原本放 YouTube 播放器的位置：band 底、1px line 邊框、4px 圓角、最小高度 96px、內距 24px／16px。
- 左側 24px 喇叭圖示（`SpeakerIcon`），平常 ink-muted，播放中變成 accent-ink；右側 font-medium 的「聲音練習」，下一行 supporting、ink-muted 的說明，播放中改成「播放中…」。
- 載入中與錯誤訊息放在面板下方，規則和 YouTube 播放器相同（supporting；載入中 ink-muted `role="status"`，錯誤 error 色 `role="alert"`）。
- 不顯示關閉字幕的提示（沒有影片）。
- **練習總覽頁**：上方小標籤是「自建練習」（別人公開的練習是「公開練習」，取代程度與分類），返回連結回到「我的教材」（別人的練習回到「公開教材」），標題下方是「共 N 句，每一句都有音檔。」，沒有播放器和影片出處。
- 建立頁的練習清單：音檔完成時，「✓ 音檔已完成」右側有 primary、sm 的「開始練習 →」。

## 頁尾與隱私權政策

- **頁尾**（`SiteFooter`）：
  - 每一頁都有，列印時隱藏；
  - 上方 1px line 線，和頁面內容之間距離 64px；
  - 內容寬度和頁首一樣，`nav` 的標籤是「網站資訊」；
  - 連結是 supporting、ink-muted 的「隱私權政策」「素材出處」，hover 時改成 ink 色並加底線。
- **隱私權政策** `/privacy`：
  - 由上到下：h1 → supporting、ink-muted 的「最後更新」日期 → 前言 → 各節（h3 標題，段落和清單用 ink-muted，寬度上限是閱讀寬度）→ 聯絡方式（accent-ink 底線連結）；
  - 內容放在翻譯檔的 `privacy.sections`，依閱讀順序排列。

## 核心元件清單

Button、Card、ProgressBar、SentenceRow、DayTracker（7 天進度）、ScoreBadge、ThemeToggle、LanguageToggle、Divider、MaterialCard、Tag、FilterChip（D70）。

## 元件規格

| 元件           | 規格                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card           | surface 背景、1px line 邊框、4px 圓角、無陰影。可點擊版本（CardLink）hover 時邊框變為 ink-muted，並有按壓與漣漪效果。                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ProgressBar    | 每一步（例如每一句）一格，accent 填滿、line 底軌，格間距 2px，高 4px；超過 30 步改為 4px 連續條。上方左側為標籤（可在旁邊顯示完成 ✓）、右側為「目前 / 總數」（可用 `showCount` 關閉），使用 12px 全大寫小標籤。數值變化 300ms 過渡。前端有領頭小橘點；動畫規則見「動態原則」。百分比模式（`format="percent"`）右側改成「40%」，用於等待時間較長的工作（`StageProgress`：標籤是目前步驟，例如「翻譯中 3/6 句」，`aria-valuetext` 讀出步驟和百分比）。語音服務忙碌時，標籤改成「語音服務忙碌，20 秒後自動繼續（4/12 句）」，進度不動，等待結束後自動繼續（D39）。 |
| ScoreBadge     | Display 襯線大數字（H1 字級）＋下方小標籤「正確率」。≥ 80% 時數字為 success，並加上「通過」文字（不只靠顏色）；低於 80% 為 ink。                                                                                                                                                                                                                                                                                                                                                                                                                                |
| SentenceRow    | 左：兩位數句號（metadata、muted）；中：英文句子（sentence 字級、`lang="en"`），作答前可隱藏；右：狀態。進行中的句子左側 2px accent 直線＋▶；完成的句子顯示 ✓（success）＋分數。句子之間 1px 細線分隔。可點擊時整列為按鈕。                                                                                                                                                                                                                                                                                                                                      |
| DayTracker     | 7 個等寬格子橫排，格線 1px。每格：襯線大數字（H3）、狀態標記（完成＝實心 accent 圓點、鎖定＝鎖頭圖示且文字 muted）、任務名稱（聽寫 / 跟讀 / 重新聽寫，760px 以上才顯示）。今天的格子底部 2px accent 底線。每格有完整的螢幕閱讀器標籤。                                                                                                                                                                                                                                                                                                                          |
| ThemeToggle    | 「跟隨系統 / 淺色 / 深色」三選一，樣式同 LanguageToggle。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| LanguageToggle | 「中文 / EN」，以原生 radio 實作（方向鍵可切換）。選中項目為 accent-ink＋底線。每個選項有固定最小寬度，切換語言時版面不跳動。                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Divider        | 1px line 細線，水平或垂直。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ButtonLink     | 外觀與 Button 完全相同的連結（例如「開始第 1 天 →」）。按壓效果只回應 Enter。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| WordDiffView   | 聽寫回饋，兩行對照：「你的答案」中寫錯或多寫的字用 error 色＋刪除線（`<del>`）；「正確答案」中沒寫對的字用 error 色＋2px 底線，並附螢幕閱讀器文字「（沒寫對）」。兩行都顯示原文寫法（不是正規化後的字）。                                                                                                                                                                                                                                                                                                                                                       |
| FilterChip     | 可複選的切換按鈕（`aria-pressed`，元件 `FilterChip`），用於教材庫與公開教材的篩選。高 32px（觸控至少 44px）、左右 12px、radius 4px、supporting 字級、數字等寬。未選：surface 底（白底）、1px line 邊框（灰框）、ink 文字，hover 邊框 ink-muted。停用（`disabled`，例如分類選滿 5 個）：透明度 40%、游標 not-allowed，不能點。已選：ink 底、ground 文字、1px ink 邊框，文字前加「✓ 」（`aria-hidden`，狀態由 `aria-pressed` 提供，不只靠顏色）。顏色過渡 160ms，focus 用既有焦點外框。                                                                           |
| CaptionHint    | 播放器正下方一行 supporting 字級、ink-muted 的提示：「如果影片出現字幕，請點播放器右下角的 CC 按鈕關閉」。不可蓋在播放器上（YouTube 條款）。                                                                                                                                                                                                                                                                                                                                                                                                                    |

## 聲音選單 `VoiceMenu`（e+ 3；2026-11-07 Joe 確認，建立與編輯練習使用）

- 建立練習時選擇聲音，像 Apple 的彈出式選單。
- **按鈕**（收合時）：外觀和表單欄位相同（surface 底、1px line 邊框、4px 圓角、內距 16px／12px，寬度上限 448px），內容是 font-medium 的聲音名稱＋ ink-muted 的「・ 女聲 ・ 美式英語」，右側 20px 向下箭頭（展開時轉 180°，reduced motion 時不轉動）。hover 邊框 ink-muted；展開時邊框 accent；`aria-expanded`、`aria-controls`。
- **面板**：按鈕下方 8px，surface 底、1px line 邊框、4px 圓角、內距 8px、無陰影；760px 以上寬 448px，以下和按鈕同寬；高度上限 min(512px, 70vh)，超過時面板內捲動。
  - 依口音分四組（美式、英式、澳洲、印度），組間 1px line 分隔。每組：font-medium 組名，下方 supporting、ink-muted 一句口音特色（也是該組的 `aria-describedby`）。
  - 每個聲音一列（至少 44px 高、4px 圓角）：左側 ✓（accent-ink，選中時才出現）、font-medium 聲音名稱（Kore、Charon，取自 Google 聲音名稱）＋ ink-muted「・ 女聲」；右側 44px 寬的 ghost、sm 試聽圖示按鈕（喇叭；播放中改成 primary、停止方塊，`aria-pressed`）。選中的列 accent 8% 底色；hover 時 ink 4% 底色；radio 有鍵盤焦點時整列有焦點外框。
- **操作**：打開時焦點移到目前的聲音；方向鍵在聲音之間移動並選取（原生 radio），Enter 或空白鍵選定並關閉；滑鼠點聲音選定並關閉；Esc 關閉並回到按鈕；點選單外面或 Tab 離開也會關閉。試聽不會改變選擇，同一時間只播一個範例，關閉時停止。
- **螢幕閱讀器**：按鈕讀作「聲音：Kore・女聲・美式英語」；每個 radio 讀作「Kore・女聲・美式英語」，試聽按鈕讀作「試聽……」或「停止試聽……」。

## 聲音卡片 `VoicePicker`（已移除）

2026-11-07 Joe 確認 VoiceMenu 後，建立與編輯練習都改用 `VoiceMenu`，卡片元件已刪除（D51）。範例音檔仍在 `public/voices/<聲音 id>.mp3`，用 `npm run voices:samples` 產生（D29）。

## 設計系統展示頁

`/styleguide` 頁面列出所有色票（兩種模式）、字級、按鈕變體與狀態、核心元件，並可切換語言檢查中英文版面，作為活的設計文件。正式上線前從導覽中隱藏。

## 聽寫畫面

目標：做一句不需要捲動，手機和電腦都一樣。

- 練習區（`practice-column`）由上到下：標題列（← 影片名、h3「第 1 天：精聽聽寫」）→ **固定進度列** → 影片 → CaptionHint → 輸入框（或對錯對照）→ 按鈕列 → 快捷鍵說明。說明文字、句子清單、出處放在練習區下方。
- 固定進度列：`sticky top-0`、`bg-ground` 底色，左側「第 N / M 句」（目前在第幾句），下方進度條（已作答幾句，不另外顯示數字）。捲動時一直留在畫面頂端。
- 影片：16:9，寬度 = min(100%, 720px, max(40svh × 16/9, 356px))，所以高度不超過畫面的 40%，也不低於 YouTube 規定的 200px。輸入區與影片同寬、左右對齊。
- 輸入框：可自動長高的 textarea，sentence 字級（18～20px）。Enter 送出、不換行；輸入法組字中（例如注音選字）按 Enter 不送出。空白時不能送出。
- 按鈕列（`PracticeActions`，D124）：左邊「播放／重播」（secondary）、「循環播放」（FilterChip，D90）、「跳過」（ghost）；**主要按鈕「送出 →」固定在最右邊**。送出或跳過後主要按鈕變成「下一句 →」（同一個位置），焦點移到「下一句」，再按 Enter 進入下一句並自動播放一次。
  - 作答區（輸入框或對錯對照）保留同樣的最小高度（`min-h-36`），所以每一句的按鈕列都在同一個位置，不會跳動。
  - **手機（< sm）**：主要按鈕放在固定在畫面底部的列（`fixed bottom-0`、`bg-ground`、上方 1px line、左右 16px、底部加上 safe-area），靠右、至少 160px 寬，拇指容易按到。用 Visual Viewport API 算出鍵盤高度（`useKeyboardInset`），鍵盤打開時整列移到鍵盤上方，不會被遮住。頁面最後加 96px 的空白（`PracticeActionsSpacer`），底部列不會擋住頁尾。
- 自動播放與循環（D90）：進入時第一句自動播放一次（瀏覽器擋下時不出聲，按「重播」即可）。「循環播放」開啟時，每句播完隔 1.5 秒（`LOOP_GAP_MS`）再播，直到送出或跳過。跟讀頁只自動播放第一句，不自動收音，也沒有循環。
- 快捷鍵：Ctrl＋空白鍵或 Ctrl＋Enter 重播（Mac 預設用 Ctrl＋空白鍵切換輸入法，所以需要 Ctrl＋Enter 當備用）。快捷鍵不會打字，也不會觸發按鈕。
- 跳過：第一次點擊變成「確定跳過？」，3 秒內再點一次才跳過，否則恢復。跳過等於送出空白答案，這句 0 分，並顯示對照（「你的答案」顯示「（未作答）」）。
- 每句第一次送出（或跳過）即算分，之後只能重播、看答案。
- **回報這句的問題（D113、D124）**：每句講解區最上方、靠右，secondary 小按鈕加旗子圖示（`FlagIcon`）＋「回報這句的問題」，每一句都在同一個位置，手機上至少 44px 高。
- **翻譯與講解（D78，2026-11-08 起）**：送出或跳過後，對照區塊（`WordDiffView`）正下方是這句的中文（supporting、ink-muted），不放在側邊。講解（`SentenceExplanation`，`showZh={false}` 不重複中文）放在快捷鍵說明下方，1px line 分隔，所有寬度都是同一欄（原本寬螢幕的右側講解欄移除）。窄螢幕送出後把對照區塊捲到頂端（`scroll-mt-16`）。聽寫結果、第 7 天週結果的逐句列表也是英文比對下方接中文；跟讀頁每句英文下方直接顯示中文（不再收起）。
- 手機與窄畫面（< wide）：點輸入框時，把影片捲到畫面頂端，讓影片、輸入框、按鈕盡量一起出現在鍵盤上方。重播（按鈕或快捷鍵）前先把影片捲回畫面，播放時一定看得到影片（YouTube 條款）。開啟 reduced motion 時直接跳到位置，不平滑捲動。
- 「完美」彩帶：當句正確率 100% 時，送出後從對照區底部中央噴出 14 片小彩帶（6×10px 直角，accent、ink、success 三色），約 1 秒（`ll-confetti`：只動 transform 與 opacity），範圍限制在對照區內（`overflow-hidden`），不蓋到 YouTube 播放器。`pointer-events: none`、`aria-hidden`，焦點照常在「下一句」，Enter 照常可用。正式作答與重練都會觸發；只在剛送出時出現，中途回來不會重播。`prefers-reduced-motion: reduce` 時不播放，改在「這句正確率 100%」旁顯示 accent-ink、font-medium 的「完美！」。
- 下方句子清單：已作答的句子顯示原文與分數，未作答的句子隱藏原文。
- 完成畫面（正式）：「✓ 今日任務完成 · 正式成績 72%」（success 色＋✓）→ ScoreBadge → 完成訊息 →「再練一次 →」（primary）「回影片頁」→ 逐句回顧（每句一組 WordDiffView 與分數）。講義完成後再加「看雙語講義」。
- 重練：正式成績完成後可以無限次「再練一次」。重練時標題下方顯示 accent-ink 的「練習模式：這次的分數不會改變正式成績（72%）」；流程與正式作答相同。重練只存在頁面記憶體，重新整理就重來。完成畫面顯示「這次的成績」＋ScoreBadge＋「正式成績 72%（不變）」與逐句回顧。

## 通關條件設定 `PassRulesSettings`（D92）

- 放在影片頁 `CycleStatus` 下方，1px line 分隔，`id="pass-rules"`（聽寫「調整通關條件」連到這裡）。
- h3「通關條件」→ 一段 supporting、ink-muted 說明 → 三個原生 `<select>`（split 以上三欄並排，手機一欄）：聽寫最低正確率、跟讀每句最低涵蓋率、第 7 天通過條件。
- 改變即儲存，下方狀態列（`role="status"`）顯示「已儲存。」；失敗時用 error 色。
- 免費方案：三個選單停用，顯示目前的預設，狀態列是「目前使用預設條件……」加 accent-ink 底線連結「看方案」。
- 還沒開始第 1 天：選單停用，提示「開始第 1 天之後就可以調整。」
- 聽寫未達最低正確率時，完成畫面改成 ScoreBadge（不顯示「通過」）＋ h3 說明＋「再聽寫一次 →」（primary）＋「調整通關條件」（ghost）。

## 分數與主題顏色 `ScoreSection`（D93）

- 放在學習分析頁最下方，1px line 分隔。h2「分數」→ supporting 說明規則 → StatTile「目前分數」（note：「再 N 分解鎖『藍』」）。
- 「主題顏色」是 fieldset：每個顏色一張 surface 卡片（1px line 邊框），裡面是原生 radio＋24px 色塊（色塊用 `data-accent` 在元素上換色）＋名稱＋「已解鎖／還差 N 分」（metadata、ink-muted）。未解鎖的 radio 停用，旁邊有 secondary sm 按鈕「NT$30 永久解鎖」。
- 按「永久解鎖」開啟 Dialog：說明即將推出、現在不收費；「加入名單」（primary）、「關閉」（ghost）；加入後顯示 success 色「✓ 已加入名單」。
- 分數紀錄：最近 14 天，每天一列（日期、success 色 +N），下面是 supporting、ink-muted 的明細。
- 強調色（`data-accent` on `<html>`）：橘（預設）、青綠、藍、紫、玫瑰紅、綠、金。只改 `--ll-accent`、`--ll-accent-ink`、`--ll-focus`；熱度圖與螢光筆不變。

## 背景主題 `BackgroundPicker`（D121）

- **是什麼**：頁面底色（`--ll-ground`）與底色上的圖案，19 種，分 6 組：極簡（預設、純白／純黑、暖灰）、紙張（米色紙張、筆記本格線、牛皮紙）、自然（森林、海洋、山景、日落漸層）、城市與氛圍（深夜咖啡廳、城市夜景、雨天窗邊）、文化（和風青海波、復古圓點、北歐）、其他（太空星空、柔和粉彩、高對比）。
- **只換底色**：卡片、輸入框、按鈕仍用 `--ll-surface` 等原本的 token；高對比背景另外加深 `--ll-ink`、`--ll-ink-muted`、`--ll-line`。
- **怎麼畫**：只用 CSS 漸層與內嵌 SVG（`data:` URI），沒有圖片檔。圖案放在 `body::before`（`position: fixed`、`z-index: -1`），不參與排版；列印時不顯示。
- **動態**：太空星空（閃爍，opacity）與雨天窗邊（雨絲往下，transform），只用合成層屬性；系統開啟「減少動態效果」時靜止。
- **對比**：每個背景、淺色與深色、底色加上圖案最濃的顏色（動態背景以兩層疊加計算），ink、ink-muted、success、error、所有強調色的 accent-ink 都 ≥ 4.5；所有強調色本身（焦點框、按鈕邊框）對底色與漸層的每一段 ≥ 3（`tests/backgrounds.test.ts`）。為此 2026-11-12 調整兩個 token：淺色 `--ll-success` #2D784C → #256B40、綠色強調色 `--ll-accent` #16A34A → #15803D。
- **設定頁**（`/account`，帳號設定）：h2「背景主題」→ 說明 → 目前分數與下一個解鎖的背景 → 依組別的 h3 與卡片格狀清單（手機一欄、split 兩欄、wide 三欄）。每張 surface 卡片：上方 80px 高的預覽，左半淺色、右半深色（各自 `data-theme`，標示「淺色」「深色」）→ 原生 radio＋名稱（動態的加 metadata「動態」）＋狀態（免費／已解鎖／還差 N 分／永久解鎖即將推出）→ ghost sm「預覽」，付費的再加 secondary sm「NT$60 永久解鎖」。
- **預覽**：按「預覽」把背景套在整個頁面，上方出現 sticky 的提示列（surface 底、accent 1px 邊框、`role="status"`）：「正在預覽……」＋可以選的有 primary sm「套用」＋ghost sm「結束預覽」。離開頁面自動回到已儲存的背景。
- **解鎖**：免費 6 種；練習分數（D93）100、200、300、400、500、700、900、1,100、1,400 分各解鎖一種；動態與城市夜景、咖啡廳 4 種是「永久解鎖」假門（價格在 `BACKGROUND_UNLOCK_PRICE`），對話框同強調色。
- **儲存**：這個瀏覽器的 `ll-background`；`<head>` 的主題 script 在畫面出現前套用（`data-bg` on `<html>`），不會閃一下預設底色。
- **styleguide**：「背景主題」區塊列出全部背景的淺色與深色，各有一般、次要、強調三種文字。

## 用 YouTube 建立練習 `YouTubeCreate`（D97）

- 建立教材的「文字來源」多一個選項「YouTube 連結」（只在設定了 YouTube API 時出現）。
- 由上到下：網址欄＋「讀取影片」（secondary）→ 影片卡（surface、1px line：標題 `lang="en"`、「頻道 · 長度」、Tag「CC BY」或「標準授權」＋一句能不能公開）→ 字幕記錄 textarea（說明怎麼從 YouTube 複製）→ 片段（從／到，分:秒）→「斷句並翻譯 →」（primary）。
- 檢查步驟：英文／中文標題兩欄 → 每句一列：metadata 時間「0:01–0:04」、英文（sentence 字級）、可編輯的中文 → 「建立練習」「上一步」→ 出處說明。
- 免費方案：只顯示一段說明和「看方案 →」。
- 「我的教材」：YouTube 練習沒有「編輯」；標準授權的不顯示公開開關，改成說明只能私人使用。

## 免手動練習（D125）

- 開關 `HandsFreeSetting`：checkbox「免手動練習（自動播放、自動收音）」，預設開啟，存在這台裝置（`ll-hands-free:v1`，關閉時為 `off`）。帳號頁「練習方式」有完整說明；聽寫、跟讀頁在快捷鍵說明下方放精簡版（未登入也能切換）。
- 開啟時，進入練習頁的主要按鈕是「開始練習 →」（同一個位置，D124），上方狀態列（`HandsFreeStatus`，`aria-live="polite"`，至少 24px 高）說明「按「開始練習」後自動播放（瀏覽器規定要先點一下才能播放聲音、開麥克風）」。開始後左邊多一個「暫停」（ghost），暫停後變成「繼續」。
- 狀態列文字：播放中、請跟著念、辨識中…（accent-ink、font-medium、前面 ●）；請輸入你聽到的句子、已暫停（ink-muted）。
- 聽寫：開始後自動播放第一句並把焦點放在輸入框；按「下一句」自動播放下一句（暫停時不播）。直接打字也算開始（主要按鈕換成「送出」）。
- 跟讀：開始後播放 → 自動收音 → 停頓後判斷；過了 1.2 秒後自動進下一句，沒過 1.8 秒後自動重播並收音。辨識錯誤（沒聽到聲音、網路）時停下來，按鈕回到「播放並跟讀」；排查對話框開著時也不自動繼續。麥克風被拒或不支援時改為「我念完了」，按下後仍自動播放下一句。
- 關閉時與原本相同：第一句自動播放一次（D90），跟讀每句按「播放並跟讀」。

## 聆聽模式 `ListenSession`（D135）

- **版面**：播放器（`PracticeFrame`）→ 控制列 → 句子列表。字幕和列表一律在播放器**下方**，不覆蓋 YouTube 播放器。
- **控制列**：
  - 上一句（←）、主要按鈕「播放／暫停」（primary）、下一句（→）、「三遍聽法」（secondary）；
  - 兩個 `SegmentedControl`：字幕（盲聽、只有英文、英中對照、只有中文）與循環（不循環、單句循環、整篇循環）；
  - 音檔教材多一個 `SpeedControl`。
  - 狀態列（`role="status"`）顯示「第 N 句／共 M 句」，三遍聽法時顯示「第 N 遍／共 3 遍：字幕」。
- **句子列表**：
  - 每句是整列的按鈕：`rounded-base`、`border-line`、`bg-surface`，手機至少 44px 高。
  - 目前的句子用 `border-accent` + `bg-band`，並加 `aria-current`。
  - 盲聽時只顯示「第 N 句」（`text-ink-muted`）。
  - 英中對照時，中文用 `text-supporting text-ink-muted` 排在英文下方；只有中文時中文用 `text-sentence`。
  - 第 1 天聽錯的字用螢光筆 `Mark kind="miss"`（D66）。
- **動態**：目前的句子平滑捲到畫面中央；reduced motion 時直接跳過去，邊框顏色也不做過渡。

## 單字測驗 `VocabQuiz`（D136）

- **進度列**：「第 N 個／共 M 個 · 第 1 關：聽音拼字」，`text-supporting text-ink-muted`，用 `aria-live` 唸出。
- **第 1 關**：
  - 「重播」「慢速播放」是 secondary 按鈕，提示是 ghost 按鈕。
  - 提示文字用等寬字型、`text-h3`、加寬字距（`_ _ _ _ _`）。
  - 輸入框和聽寫一樣大（`text-sentence`），關閉自動大寫、自動修正、拼字檢查。
- **逐字母標示**：
  - 對的字母用一般文字色；
  - 拼錯或漏掉的字母用 `text-error`、`bg-error/15`、粗底線；
  - 多打的字母用 `text-error` 加刪除線。
  - 下方有一行文字說明三種標示，所以不只靠顏色區分；整個字另外提供 `aria-label`「正確拼法是 …」。
- **第 2 關**：
  - 四個選項是整列的 `label`，裡面是原生 radio，手機至少 44px 高。
  - 答完後正確選項用 `border-success` 並標「正確答案」，選錯的用 `border-error`。
  - 說明卡用 `bg-band`，內容是詞性、中文、例句與翻譯。
- **主要按鈕**：用 `PracticeActions`（D124），在右邊；手機固定在畫面底部、鍵盤上方。頁尾放 `PracticeActionsSpacer`。
- **結果頁**：三個數字卡（拼字正確、翻譯正確、使用提示），加上每個字的結果清單；拼字和翻譯各用 ✓／✗ 加文字。
- **入口卡 `QuizInvite`**：`border-accent` + `bg-band`，按鈕是「開始測驗」（primary、small）與「跳過」（ghost）。

## 跟讀畫面

第 2～6 天共用同一個畫面（`ShadowingSession`），版面比照聽寫畫面。

- 練習區由上到下：標題列（← 影片名、h3「第 N 天：跟讀」）→ 固定進度列（「第 N / M 句」＋已完成幾句的進度條）→ 提示框（需要時才出現）→ 影片 → CaptionHint → **狀態區** → 句子 → 按鈕列 → 快捷鍵說明 → 講解區（最上方是「回報這句的問題」，自建練習接著是講解）。說明文字、出處、句子清單放在練習區下方。
- **狀態區在句子正上方（D124）**：「你念的：…」（body 字級）與「✓ 念完了 · 涵蓋率 N%」（font-medium，success 色）是念完後最先看的，放在句子正上方；保留至少 64px 高度，出現結果時句子不會跳動。講解放在按鈕列下方。
- 按鈕列同聽寫（`PracticeActions`）：主要按鈕（播放並跟讀、下一句、再試一次、我念完了）固定在右邊，手機在底部列。
- 句子：英文一直顯示（sentence 字級、`lang="en"`）；中文放在可收合的「中文」（`<details>`，supporting、ink-muted），預設收合。
- 自建練習（e+ 7，D42）：沒有影片可以看，所以不用「中文」收合，改在句子下方直接顯示這句的講解（`SentenceNotes`，和聽寫每句答完後的回饋相同）：1px line 分隔線 → 中文 → 單字（metadata 小標籤，單字 font-medium、`lang="en"`、詞性 supporting ink-muted、中文）→ 文法（句型 font-medium、`lang="en"`，說明 supporting ink-muted）。換到下一句時跟著換。
- 流程：「播放並跟讀」（primary）→ 按鈕變成停用的「播放中…」→ 這句播完後自動開始收音，顯示 accent-ink 的「● 正在聽你念…」與即時辨識的字，按鈕變成「停止」→ 停頓 1.5 秒自動結束（8 秒都沒聽到聲音則視為沒有聲音）。
- 結果：涵蓋率達到門檻（預設 60%，D92）顯示 success 色「✓ 念完了 · 涵蓋率 85%」，按鈕變成「下一句 →」並取得焦點，按 Enter 進入下一句並自動播放、收音；最後一句變成「查看結果 →」。未達門檻顯示「涵蓋率 50% · 還差一點，再試一次。」與「再試一次」，次數不限。
- 漏念的字：結果出來後，句子上漏念的字改成 error 色＋底線，並附螢幕閱讀器文字「（漏念）」，不只靠顏色區分。
- 每句保留最好的一次涵蓋率；念完的句子不會因為後面念得較差而變回未完成。
- 提示框（`role="alert"`，surface 底、1px line 邊框）：瀏覽器不支援語音辨識、Brave 瀏覽器（用 `navigator.brave` 判斷；它有語音辨識介面但連不到辨識服務，每次都回報網路錯誤）、連續兩次網路錯誤、麥克風被拒、找不到麥克風時出現，標題用 error 色，內文說明怎麼處理。這時按鈕改成「播放」（secondary）＋「我念完了」（primary），使用者自己聽、自己念，按「我念完了」就算完成，紀錄的涵蓋率為空，清單顯示「自行完成」。
- 暫時性錯誤（沒有聽到聲音、網路、其他辨識錯誤）：不出現提示框，只在狀態區顯示 error 色訊息，按鈕回到「播放並跟讀」讓使用者重試。網路錯誤連續第二次時改成提示框（「請改用 Chrome 或 Edge，或使用「我念完了」完成練習」）；中間只要成功辨識一次或出現其他錯誤，就重新計算。
- 快捷鍵：Ctrl＋空白鍵或 Ctrl＋Enter 重播（收音中不作用）。
- 下方句子清單：每句顯示原文、✓ 與最好的涵蓋率（或「自行完成」），目前這句加 `aria-current="step"`。
- 完成畫面（正式）：「✓ 今日任務完成」→「今天的跟讀完成了！」→「完成 N / M 句 · 平均涵蓋率 85%」（平均只算有辨識的句子）→ 下一天提示（NextDayNote）→「再練一次 →」（primary）「看雙語講義」（secondary）「回影片頁」（ghost）→ 句子清單。
- 重練：規則同聽寫。標題下方顯示「練習模式：這次的結果不會改變今天的紀錄。」，只存在頁面記憶體；完成畫面顯示「練習完成！」與「今天的紀錄不變。」。網址加 `?retry=1` 且當天已完成時，直接進入重練。

## 首頁

（D79，2026-11-08 起）由上到下：標題與標語 →

- **標題區**（D119）：h1 產品名稱（hero）→ 16px → 標語（display、h3 字級）→ 12px → 一行 ink-muted 說明（閱讀寬度內）：適合誰、三個步驟、官方教材免費。

- **登入**：練習日曆（Card）→ 24px → 今日任務（Card）→ 64px → 官方教材庫；
- **未登入**：產品介紹（`ProductIntro`）→ 64px → 官方教材庫。

「學習進度」頁 `/practices` 保留完整版（日曆加上每份練習的清單）。新手引導（`Onboarding`）只給已登入、還沒有練習的人。

### 產品介紹 `ProductIntro`（D70）

- Card（surface、1px line、4px、內距 24px）：Display h2「怎麼練：七天一個循環」→ 24px → 三個步驟（split 以上三欄、以下堆疊，間距 24px）：Display h3「**1** 第 1 天 聽寫」（數字 accent-ink、等寬）＋ supporting、ink-muted 說明。
- 24px 後：primary、md「登入」＋同一行 supporting、ink-muted「不用登入也能練習；登入後可以看練習日曆、今日任務和學習分析。」（窄螢幕換行）。

### 教材庫 `MaterialLibrary`（D70，取代原本的「推薦練習」和「官方教材」兩區）

- Display h2「教材庫」＋ ink-muted 說明；section `id="library"`（`scroll-mt-8`）。內建影片和官方音檔教材放在同一個清單（`getLibraryItems`），不再依合集分組。
- **版面**：
  - wide（1024px）以上：左側 15rem 篩選側欄（`<aside>`，名稱「篩選」）＋ 48px ＋ 右側結果；
  - 以下（D127）：沒有側欄；搜尋列下方是**預設展開**的篩選區塊（1px line 邊框、4px 圓角、內距 16px），標題列左邊 metadata 大寫「篩選」（有條件時「篩選（2）」），右邊 ghost、sm「收合篩選／展開篩選」（`aria-expanded`）。原本的底部抽屜移除。
- **搜尋列**（結果欄最上方，`flex-wrap`、間距 12px）：
  - 「搜尋」欄位（metadata 大寫標籤在上，`type="search"`，高 40px、觸控 44px，表單欄位樣式，最小寬 12rem 並佔滿剩餘空間）：標題＋副標包含每個詞就符合；
  - 「排序」原生 `<select>`（同高）：推薦、最新、最短、最多人練。
- 下方一行 supporting、ink-muted、`aria-live="polite"`：「3 份教材」；有任何條件時旁邊 ghost、sm「清除篩選」。
- 卡片網格：split 以上兩欄、間距 24px，卡片等高（`h-full`，最下行貼底）。
- 沒有符合：ink-muted「沒有符合的教材。」＋ secondary「清除所有篩選」。
- **網址參數**（`router.replace`，不捲動、不加紀錄；不認得的值忽略）：`q`、`type`、`cat`（最多 5 個）、`sc`、`level`、`len`（`all` 不寫）、`accent`、`sort`（推薦是預設，不寫進網址）。伺服器先輸出沒有篩選的列表（Suspense fallback）。

### 篩選群組 `LibraryFilters`（D70）

- 每組：metadata、ink-muted、字距加寬的標籤（`role="group"` 的名稱）→ 8px → FilterChip 一排（換行，間距 8px）。組與組之間 24px。
- 順序：類型（影片、音檔）→ 分類 → 情境（選了分類後才出現，只列所選分類裡實際有教材的情境，D79）→ 程度（初級、中級、高級）→ 長度（D104：SegmentedControl 單選「全部長度／3 分鐘以下／3–5 分鐘／5–10 分鐘／10 分鐘以上」，區間在 `lib/library-config.ts` 的 `LIBRARY_LENGTHS`，一律顯示）→ 口音。
- **分類**（D104）：第一個 chip「全部」，沒有選任何分類時是已選狀態，按下清除所有分類（和底下的情境）。最多選 5 個（`MAX_CATEGORIES`），選滿時其他沒選的 chip 停用；有選分類時，組名同一行右側顯示 metadata、ink-muted「已選 X / 5」（`aria-live="polite"`）。
- **自動搜尋**（D104）：分類或長度改變後 300ms（`SEARCH_DEBOUNCE_MS`）向伺服器搜尋官方教材庫，不需要按鈕；搜尋中，結果列顯示「搜尋中…」。搜尋失敗時用同樣規則在頁面上篩選。
- 都可複選；取消一個分類時，它底下已選的情境一起取消。同一組選了幾個就是「其中之一」，不同組之間是「而且」。
- 每個 chip 後面括號是符合的份數（不受其他條件影響）。教材庫裡某一組只有一種值時，整組不顯示（已經選取時例外）。

- **順序與形式（D127）**：由上到下「我今天有幾分鐘」（不限、5、10、15、20、30 分鐘內，依每份教材的平均每天練習時間）→ 程度 → 分類（＋情境）→ 類型 → 長度 → 口音。全部是 `FilterChip`，按下立即篩選；單選的群組（分鐘、長度）第一個是「不限／全部長度」。
- **分類**：先顯示教材數最多的 6 個（`MAIN_CATEGORY_COUNT`）與已選的，其餘收在 ghost、sm「更多類別（N）」後面，打開後變成「收起類別」（`aria-expanded`）。

### 教材卡片 `MaterialCard`（D70）

CardLink，內容由上到下：

1. 標籤列（`Tag`，間距 8px、可換行）：類型（影片／音檔圖示＋文字）、分類、程度（文字，不靠顏色），自己建立的加「你建立的」。
2. 考試教材：supporting、ink-muted「多益 TOEIC 風格 · 目標 750 分」（12px 間距）。
3. 16px 後 Display h3 標題（內建影片標 `lang="en"`）→ 4px 後 supporting、ink-muted 副標（D71，沒有就不顯示）。
4. 進度（`VideoProgressLabel`：「第 3 天 · 跟讀」等，同之前）。
5. 最下行（貼卡片底部，上方至少 16px）：supporting、ink-muted「2 分 5 秒 · 英式英語 · 每天約 9 分鐘」＋右側 →。不足 1 分鐘時「49 秒」。

### 教材標題 `MaterialTitle`（D83）

- 所有教材都有英文與中文標題，一律先英文後中文。
- **兩行**（卡片、練習頁、講義與 PDF）：第一行英文（`lang="en"`，Display 字級依所在位置），第二行中文（卡片是 supporting、ink-muted；練習頁與講義是 Display h2、ink-muted），再下一行是副標題（supporting、ink-muted）。
- **單行**（`compact`，以及頁首返回連結、今日任務、練習日曆、學習進度、後台清單、頁面 `<title>`）：「English Title｜中文標題」，中文部分 ink-muted，超出時以省略號截斷（`truncate`，完整標題放在 `title`）。單行後面接其他資訊時用「 · 」，例如「Sintel｜辛特爾 · 第 1 天 聽寫」。
- 還沒有中文標題的舊資料只顯示一行。
- **建立與編輯表單**：「標題」是一個 fieldset，裡面並排兩個欄位「英文標題」（`lang="en"`）、「中文標題」，手機上下排列；下面的提示說明哪些會自動產生。檢查步驟（建立）與編輯頁的 fieldset 裡多一個「副標題」欄位（最多 60 字）。編輯頁至少要填一種語言。

### 標籤 `Tag`（D70）

- 卡片上的資訊標籤，不能點：1px line 邊框、4px 圓角、左右 8px、最小高 24px、metadata 字級、ink-muted；可帶 16px 圖示（間距 4px）。
- 可點的篩選一律用 FilterChip，兩者外觀刻意不同（Tag 沒有 hover、沒有 ✓）。

### 公開教材 `/explore`

- 其他人公開的練習（D30），所有人都看得到，不用登入。入口是頁首「學習進度」右邊的「公開教材」。
- h1「公開教材」→ 說明（ink-muted、閱讀寬度）→ 32px 後是篩選區：
  - 「搜尋標題」欄位（表單欄位樣式，寬度上限 720px，`type="search"`）：標題包含輸入的每個詞就符合（不分大小寫、順序，全形英數字也算）；
  - 「原文」篩選列：FilterChip「英文（3）」「中文（1）」；
  - 「長度」篩選列：FilterChip「10 句以內」「11～30 句」「31 句以上」（`SENTENCE_BUCKETS`）。
  - 兩列的標籤和題庫一樣是 metadata、ink-muted、字距加寬；`role="group"`。可複選，沒有選取＝全部；有任何條件時，長度列最後有 ghost、sm 的「清除」。下方一行 `aria-live="polite"` 的「顯示 N 份練習」。
- 卡片 grid（split 以上兩欄），最新的在前：CardLink，最上行「英文原文 · 英式英語・男聲」→ Display h3 標題（不標 `lang`，可能是中文）→ 進度（同題庫）→ 最下行「6 句」，自己建立的加上「 · 你建立的」。
- 只列出講解和音檔都完成的練習。沒有任何公開練習時，只顯示 ink-muted 的「目前還沒有公開的練習。」（沒有篩選區）；篩選後沒有符合時，ink-muted「沒有符合的練習。」＋ secondary「清除篩選」。
- 篩選狀態不存在網址（和題庫不同），重新整理會清空。

### 檢舉與審查（e2）

- **檢舉**（`ReportPractice`）：別人公開的練習總覽頁最下方，1px line 分隔線下方是 ghost、sm 的「檢舉這份練習」。展開後是一個 1px line 邊框、4px 圓角、內距 16px 的區塊：
  - Display h3「檢舉這份練習」→ supporting、ink-muted 說明（作者不會知道是誰檢舉的）；
  - 「原因」：5 個原生 radio（accent 色），每個選項下方有一行 supporting、ink-muted 的說明；
  - 「補充說明（選填）」文字框＋metadata 字級的「12 / 1000 字」，超過時變成 error 色；
  - primary、sm「送出檢舉」（還沒選原因時停用）＋ghost、sm「取消」；
  - 送出後整塊換成 success 的「已收到你的檢舉……」（`role="status"`）。錯誤用 error 色 `role="alert"`。未登入時展開後只顯示「登入後才能檢舉」。
- **審查頁** `/admin/reports`（只有管理員，其他人 404；入口在「我的教材」上方的 accent-ink 底線連結「檢舉審查（N 份練習待處理）→」）：
  - h1 → 說明 → h2「待處理（N）」→ 依練習分組的清單（上下和項目之間 1px line）：練習標題連結（font-medium）→ supporting、ink-muted 的「3 則檢舉 · 侵權 2・其他 1」→ 每則檢舉的日期、原因與補充說明 → 操作列：「下架原因」原生 select（預設是最多人選的原因）、danger、sm「下架」、secondary、sm「駁回」。
  - h2「已下架」→ 每列標題、「原因：侵權 · 日期」，右側 ghost、sm「恢復」。
- **作者看到的下架**（「我的教材」的練習列）：清單資訊下方一行 supporting、error 色的「已被管理員下架（原因：侵權）……」，不再顯示「私人 / 公開」切換。

### API 用量 `/admin/usage`（D38）

- 只有管理員能看，其他人看到 404。入口在「我的教材」，「檢舉審查」連結的右邊，同樣是 accent-ink 底線連結「API 用量 →」。
- **設定診斷**（D47）：說明下方的 surface 卡片，h3「設定診斷」→ 說明 → 結果（success 或 error 色的一行）→ 三組清單（帳號與資料庫、AI 文字、聲音），每組 metadata 大寫標題＋上下 line 的 supporting 清單，每列左邊是條件，右邊是 success「✓ 成立」或 error「✗ 不成立」。不顯示任何設定值；沒有秘密金鑰時只顯示這一區。
- **測試連線**（D49）：在設定診斷卡片裡，h3「測試連線」→ supporting、ink-muted 說明 → secondary、sm 的 Button「測試連線（免費）」（進行中顯示「測試中…」）→ 結果清單（樣式同診斷清單：左邊「AI 文字」「聲音」，右邊 success「✓ 連線成功」或 error「✗ 失敗（HTTP 404 DeploymentNotFound）」，失敗時下一行是 ink-muted 的提示）。結果區是 `aria-live="polite"`。
- **呼叫紀錄的失敗原因**：有狀態碼或錯誤代碼時顯示「失敗（config；HTTP 404 DeploymentNotFound）」，沒有時維持「失敗（config）」。
- h1 → 說明 → 4 張統計卡片：
  - 360px 以下一欄，760px 以上兩欄，間距 16px；
  - 卡片同 Card：surface 背景、1px line、4px 圓角、內距 16px；
  - 卡片內：metadata 全大寫小標籤 → Display h2 等寬數字 → supporting、ink-muted 說明。
- h2「最近 50 次呼叫」→ 表格：
  - 上下 1px line，列之間 1px line，supporting 字級，數字等寬；
  - 標題列 ink-muted、不加粗；
  - 數字欄靠右；結果欄：成功是 success 色，失敗是 error 色並附上原因文字（不只靠顏色）；
  - 窄螢幕時表格本身可以左右捲動（最小寬 40rem），頁面不會橫向捲動。

## 七天循環

- 解鎖：Day 1 永遠開放；第 N 天在第 N−1 天完成後的**之後日曆日**開放（裝置當地日期）。已完成的天數一直可以回看與重練。`NEXT_PUBLIC_DEV_TEST_MODE=true` 時略過日期限制（仍需完成前一天），影片頁顯示 metadata 字級提示「測試模式：已略過日期限制」。
- 影片頁（`CycleStatus`，在影片與「練習片段：N 句」下方）：第 2 週起先顯示 metadata 大寫字距的「第 2 週」→ DayTracker（真實狀態；點未鎖住的格子前往該天）→ 今天的任務列：
  - 有可做的天：「開始第 3 天：跟讀 →」（primary、lg）。
  - 今天的任務已完成：「✓ 今日任務完成」（success）＋下一行「第 4 天（跟讀）明天開放」（supporting、ink-muted）→「再練一次 →」（primary，連到該天 `?retry=1`）「查看結果」（secondary）。
  - 已通過：「✓ 已通過」（success）＋下一行「第 1 天 60% → 第 7 天 85%」（ink-muted）→「查看週結果」（secondary，連到第 7 天）。
  - 沒通過：「這週沒通過（第 7 天 72%）」＋「第 2 週明天開始」（ink-muted）→「查看週結果」；第 7 天之後的日曆日（或測試模式）改成「開始第 2 週 →」（primary）。
  - 講義：第 1 天完成後（或已有往週紀錄）顯示「看雙語講義」（secondary），否則「雙語講義：完成第 1 天後開放」。
  - 伺服器與讀到進度前，一律顯示全新循環（Day 1 開放）。
- 鎖住的天數頁（`DayGate`）：直接打開未解鎖的天數時不載入練習（也不建立紀錄），改顯示「← 影片名」→ h3「第 N 天尚未開放」→ 原因：「請先完成第 N−1 天。」＋「前往第 N−1 天 →」（primary）＋「回影片頁」（ghost）；或「第 N−1 天今天才完成，第 N 天明天開放。明天再來！」＋「回影片頁」（secondary）。
- 完成畫面的下一天提示（`NextDayNote`）：「第 N+1 天（跟讀）明天開放。」（supporting、ink-muted）；已開放時改成 accent-ink 底線連結「第 N+1 天已開放 →」；下一天已完成時不顯示。
- 首頁影片卡片：標題下方一行進度（supporting）：「第 3 天：跟讀」、「✓ 今日任務完成」、「✓ 已通過」（success）、「第 1 週未通過 · 第 2 週明天開始」（或「可以開始第 2 週」）；第 2 週起前面加「第 2 週 · 」；沒開始過不顯示。

## 第 7 天與週結果

- 第 7 天（重新聽寫）沿用聽寫畫面（流程、每句講解、重練、快捷鍵都相同），標題「第 7 天：重新聽寫」。最後一句送出時，正式成績與週結算一起儲存。
- 週結果（`WeekResult`，第 7 天正式完成畫面；重練完成仍用聽寫的重練結果）：「✓ 今日任務完成」→ h2「第 1 週結果」→ 對比列：「第 1 天」（metadata 標籤＋H1 字級 ink-muted 數字）→ →（Display）→「第 7 天」（ScoreBadge，≥ 80% 為 success 並加「通過」）→ 差距一行（supporting）：「進步 25 個百分點」（success）／「比第 1 天低 5 個百分點」／「和第 1 天一樣」（ink-muted），以畫面上四捨五入後的百分比相減。
- 結論（Display h3）：通過「通過！這支影片的七天循環完成了。」→「選下一支影片 →」（primary，首頁）「看雙語講義」（secondary）「回影片頁」（ghost）。沒通過「還差一點：第 7 天要達到 80% 才通過。同一支影片再練一週。」→ 當天顯示「第 2 週明天開始」（ink-muted），之後的日曆日或測試模式顯示「開始第 2 週 →」（primary，存檔後前往新一週的第 1 天）＋「回影片頁」。
- 逐句比較（h2）：每句一列：兩位數句號、第 7 天的 WordDiffView、「第 1 天 40% → 第 7 天 90%」（supporting、ink-muted、不換行）；進步的句子加 success 色「↑」與螢幕閱讀器文字「（進步）」。
- 往週紀錄（只在有更早的週時顯示）：「第 1 週 · 第 1 天 60% → 第 7 天 72% · 未通過」（supporting、ink-muted）。

## 獎勵（點數與飼料）

> M2.5 暫停：本節的畫面目前以功能開關關閉（`lib/features.ts`），規格保留供日後恢復。

規則見 `docs/aquarium.md`。點數只用來買魚；飼料每天完成任務得 1 份，用來餵魚。

- 頁首（`RewardBadge`，語言切換左邊，中間以 vertical Divider 分隔）：`PointsIcon`＋（760px 以上才顯示的 ink-muted「點數」）＋數字、`FeedIcon`＋「飼料」＋數字；supporting 字級、tabular-nums，圖示 16px accent-ink。螢幕閱讀器讀完整文字「點數 120、飼料 2 份」。讀到資料前不顯示（伺服器 HTML 一致）。
- 剛得到時：數字右邊出現 accent-ink「+12」，`animate-gain`（2 秒：上升淡入 → 停留 → 淡出），2 秒後移除；reduced motion 時不動畫、直接顯示 2 秒。同時以 `aria-live="polite"` 讀出「獲得 12 點數 · 1 份飼料」。
- 完成畫面（聽寫、跟讀、週結果；正式與重練）：「✓ 今日任務完成」下方一行 accent-ink supporting「獲得 12 點數 · 1 份飼料」，只在這次真的有得到時顯示，數量為 0 的項目省略。
- 圖示：`PointsIcon`（貝殼）、`FeedIcon`（三顆飼料），16×16 viewBox、線寬 1.25，與 `LockIcon` 同一套；一律搭配可見文字或螢幕閱讀器文字。

## 像素魚（M2.5 魚缸）

> M2.5 暫停：本節的畫面目前以功能開關關閉（`lib/features.ts`），規格保留供日後恢復。

魚、魚缸、飼料都是程式繪製的「高細節寫實像素風」（`lib/pixel-fish/`，規劃見 `docs/aquarium.md`）。風格是「寫實配色＋大眼萌系」：花紋、配色、光影寫實，眼睛超大、身體稍圓稍短（完整規則見 `docs/aquarium.md` 第 1a 節，所有魚種都照這套規則）。樣板在 `/styleguide` 的「PixelFish · clownfish」。

- 繪製：純函式依魚種參數算出每個像素（RGBA），元件畫到 canvas。魚種參數包括側面輪廓（每一欄身體上下緣）、各鰭形狀、尾鰭扇形、胸鰭、眼睛、花紋（`paint`）與色票，放在 `lib/pixel-fish/species/`。
- 尺寸：每種魚一個小畫布（水蝸牛 48 × 34、小丑魚 96 × 60、大白鯊 180 × 96、鯨鯊 270 × 110 像素，四隻同缸時大小合理），顯示時只用整數倍放大（2×、3×、4×），並關閉影像平滑化（`imageSmoothingEnabled = false`），依裝置像素比再乘整數，像素保持銳利。
- 光影：光從左上方照下（魚轉向時光源不變）；身體視為圓柱算明暗，加上腹部的水中反光與少量高光；每種材質 5 階色階，身體用 4×4 有序抖色讓過渡細緻，鰭不抖色。
- 鰭：細鰭條（比底色暗一階的細線）；小丑魚的背鰭、臀鰭、腹鰭、尾鰭有黑色邊緣，胸鰭較淺。
- 描邊：選擇性描邊，外輪廓用同色系較深的色階（不用純黑）；背光側（下方、遠離光源的一側）最深。
- 顏色是插畫內容，不使用介面的色彩 tokens。所有色票（包括眼睛的 iris、pupil、glint，以及與身體同色的 eyelid）、眼睛比例、圓潤度、游速、深度集中在 `lib/pixel-fish/style.ts`。
- 水蝸牛：另一套繪製（`snail.ts`）：腹足、對數螺線殼、兩根觸角，眼睛在觸角頂端；爬上缸壁時整張圖轉 90°（眼睛的反光點仍朝左上）。
- 眼睛（`lib/pixel-fish/eyes.ts`）：另外畫成小圖疊在身體上，位置跟著身體波動。直徑約頭高 1/3；深色虹膜下半帶暖色反光；兩個白色反光點（大的在左上朝光源、小的在右下），光源固定、轉身不翻轉。瞳孔依視線偏移最多約半徑的 0.28。
- 表情：open（看向目標）、blink（眼皮＋睫毛線，約 150 毫秒，每 2～6 秒隨機一次）、happy（^ ^，吃到飼料後約 2 秒）、hungry（上眼皮蓋到中線、眼珠往下，並游得較慢較低）。飼料是 5 × 4 像素的棕色顆粒，同一套光影。
- 動畫：尾巴 4 格（中 → 上 → 中 → 下，身體由頭到尾的波動同時起伏）、胸鰭 2 格拍動、轉身 4 格（橫向壓窄 → 翻面 → 展開）；畫格每秒約 8 格，位置用 requestAnimationFrame 平滑移動。所有畫格第一次使用時算好並快取，之後只做 `drawImage`。
- 魚缸背景：同一套風格（水色由淺到深的抖色漸層、斜向光束、水面波紋、沙底、石頭、水草），整張不透明。
- 減少動態效果：不啟動動畫迴圈，魚靜止，不眨眼、眼珠不動；只顯示靜態表情（按鈕切換：「轉身」直接換方向、「撒飼料」直接顯示 ^ ^）。
- 無障礙：單張畫格的 canvas 是裝飾（`aria-hidden`），旁邊一定有文字；會動的魚缸 canvas 用 `role="img"` 與說明文字。

## 魚店與我的魚

> M2.5 暫停：本節的畫面目前以功能開關關閉（`lib/features.ts`），規格保留供日後恢復。

- 路徑 `/shop`，內容寬度上限 1080px。入口：頁首的點數徽章整個是連到魚店的連結（螢幕閱讀器讀「點數 120、飼料 2 份，前往魚店」）。
- 由上到下：h1「魚店」→ 說明（ink-muted，點數只能買魚、不能退回）→ Display h3「你有 120 點數」→ 購買結果（aria-live，success）→ 魚的卡片（Card，760px 以上兩欄）→「我的魚」→ 頁尾「素材出處」連結。
- 魚的卡片：縮圖（4:3、band 底，該魚種的像素畫肖像：朝右、睜眼看前方，依卡片大小選最大的整數倍放大）→ h2（Display h3 字級）魚名 → 一句介紹（supporting、ink-muted）→ 價格「40 點數」→「購買」（secondary）。
- 購買要再確認一次：按「購買」後同一張卡片顯示「用 40 點數購買小丑魚？」與「確定購買」（primary）「取消」（ghost）。點數不夠時「購買」停用，旁邊顯示「還差 N 點數」。
- 買到的魚如果魚缸還有位置，直接放進魚缸；魚缸已滿（12 隻）時改說明「可以在『我的魚』換一換」。購買後頁首的點數立即更新。
- 我的魚（`#my-fish`）：「魚缸 3 / 12」與說明 → 每隻魚一列（1px line 分隔）：「小丑魚 #2」（起始的水蝸牛顯示「水蝸牛 · 見面禮」）＋勾選框「放進魚缸」；魚缸已滿時，沒放進去的魚勾選框停用並顯示「魚缸已滿」。

## 素材出處

- 路徑 `/credits`。列出所有使用的影片（VideoAttribution，標示作者、標題、授權與修改說明）。魚、魚缸、飼料是 ListenLoop 自己繪製的像素畫，不需要標示。

## 講義頁

- 路徑 `/videos/<id>/handout`。內容寬度上限 1080px（`max-w-content`）。
- 開放時機：第 1 天正式聽寫完成後才顯示講義（先聽寫、再看原文）。未完成時顯示說明與「前往第 1 天」；影片頁顯示「雙語講義：完成第 1 天後開放」。進度存在瀏覽器，屬於軟鎖。
- 入口：影片頁（第 1 天完成後的「看雙語講義」）、聽寫與跟讀的完成畫面（正式與重練都有）。
- 英中對照：一句英文（sentence 字級、`lang="en"`）下方緊接中文（supporting、ink-muted），左側兩位數句號。
- 單字：表格四欄（單字、詞性、中文、例句），1px line 分隔；760px 以下改為一個字一塊。列印時固定四欄。
- 文法：每點一段，標題（Display h3，`lang="en"`）、說明、例句（ink-muted）。
- 最後是 VideoAttribution（CC BY 要求，列印時也要有）。
- 輸出 PDF：「輸出 PDF」按鈕呼叫瀏覽器列印，提示使用者在列印視窗選「儲存為 PDF」。
- 列印規則（`globals.css` 的 `@media print` 與 `@page`）：A4、邊界 16mm、11pt；不管網站主題一律白底黑字；頁首、按鈕、返回連結用 `print:hidden` 隱藏；句子、單字列、文法點與出處加 `break-inside-avoid`，不被切到兩頁；第一頁頂端有標題與「ListenLoop · 列印日期」。

## 對話框 `Dialog`（D52）

- 原生 `<dialog>` 加 `showModal()`：焦點限制在對話框內，背景不能操作，Escape 關閉（呼叫 `onClose`）。
- surface 底、1px line 邊框、4px 圓角、內距 24px；寬度最多 32rem，手機留左右 16px。背景遮罩是 ink 40%。
- 內容：Display h3 標題（`aria-labelledby`）→ 16px 間距的內文 → 按鈕列（primary 在前，其他用 secondary）。
- **底部抽屜**（`variant="sheet"`，D70）：手機上的篩選。貼齊畫面底部、全寬，只有上緣 1px line 和上方兩角 4px 圓角，高度最多 85dvh（超過時抽屜內捲動）。焦點、Escape、背景遮罩同一般對話框。最下方 1px line 分隔後是按鈕列：primary「顯示 N 份教材」（關閉）＋有條件時 secondary「清除所有篩選」。

## 完美彩帶 `PerfectCelebration`（D52）

- 聽寫和跟讀一句 100% 時使用：播放 `PerfectBurst` 彩帶（範圍限制在結果區，不蓋住播放器）。系統設定減少動態效果時，改在分數後面顯示 accent-ink、font-medium 的「完美！」。

## 跟讀的排查對話框（D52）

- 標題「這句好像一直辨識不出來」→ 說明 → 4 個建議（supporting 項目清單）→ ink-muted 的 supporting 說明（跳過算完成、回報不含錄音）→ primary「再試一次」、secondary「跳過這句並回報」。
- 逐句紀錄中，跳過的句子顯示「✓ 已跳過」。

## 管理員後台 `/admin`（D56）

- **入口**：頁首「後台」連結（只有管理員看得到），樣式同「學習進度」。
- **區塊導覽 `AdminNav`**：頁面內容上方，下緣 1px line。每個連結是 supporting 字級：目前的區塊是 ink 字色加 2px accent 底線，其他是 ink-muted（hover 變 ink）。手機上不換行，改成左右捲動。
- **頁面**：h1 → ink-muted 說明 → 內容。數字用 `StatTile`（metadata 大寫標籤、Display h2 數字、supporting 說明），排成 1／2／4 欄（窄／split／wide）。總覽依主題分組，每組一個 h3。
- **表格**：上下 1px line、列之間 1px line；表頭是 ink-muted、font-normal；數字欄用 tabular-nums。手機上可以左右捲動（`overflow-x-auto`，表格有最小寬度）。連結用 accent-ink 底線。
- **篩選列**：label 在上的欄位（surface 底、1px line 邊框），手機一欄、split 兩欄、wide 一排；secondary「篩選」按鈕。
- **使用者個人頁**：← 使用者 → h1「使用者 001」→ 日期清單（ink-muted 標籤＋值）→ 角色與狀態（停用時用 error 色）→ secondary 小按鈕「設為管理員」／「改為一般使用者」，ghost「停用帳號…」按下後變成 primary「確定停用」＋ ghost「取消」，並顯示說明 → h2「最近的操作」與紀錄表格。
- **容易出錯的句子**：清單，每項依序是 ink-muted 的出處（練習名稱・第 N 句）、sentence 字級的英文、supporting 的統計數字、accent-ink 連結（編輯或打開影片頁）。
- **待審修正**（`/admin/fixes`，D117）：h1 → 說明 → 類型篩選（圓角膠囊連結，高 44px，1px line 邊框；目前的用 accent 邊框、accent 14% 底、accent-ink 字，`aria-current`；名稱後面是 tabular-nums 數量）→ 依教材分組（h2 是教材英文標題連結，下一行 ink-muted 中文標題）。每筆：ink-muted「第 N 句 · 類型」→ sentence 字級英文 → 翻譯修正用兩欄定義清單（ink-muted「現在」／「建議」，建議用 font-medium；手機一欄）；講解精簡顯示「講解 X 字 → Y 字」、精簡步驟清單、`<details>`「比較修改前後的講解」（split 以上左右兩欄，用講解元件呈現）→ ink-muted 理由 → primary 小按鈕「接受」、ghost「拒絕」。決定後按鈕換成 ink-muted 的結果文字（`role="status"`），下次打開才從清單消失。

## AI 生成練習的選項（D57、D81、D82）

建立頁的順序（D82，2026-11-08 起），讓第一次使用的人由上往下填完：

1. **標題**：在整個表單最上方。選「AI 生成」時標籤是「標題（選填）」，下面一行 supporting、ink-muted 說明「有填的話，標題會原樣保留……生成後都可以修改。」（`aria-describedby`）；貼上文字時是「標題」。
2. **文字來源**：SegmentedControl「貼上或上傳文字 / AI 生成」。
3. **想練什麼**（split 以上兩欄）：
   - 「類別」下拉，最後一項是「自訂類別…」；
   - 選了自訂類別：右邊換成「類別名稱（必填）」欄位（最多 40 字，placeholder「例如：天文攝影、桌遊」）＋說明「在教材庫的篩選中歸類為『其他』」；
   - 其他類別：右邊是「情境」下拉，最後一項是「其他（自己描述）」（考試類沒有這一項）；考試類多一個「考試」下拉與題型說明。
4. 「**想練什麼？**」多行欄位（三行、最多 200 字，placeholder「例如：跟教授請病假並詢問補交作業」）＋說明：可以描述情境、主題或關鍵字，選了情境也能補充細節。選「其他（自己描述）」時標籤變成「（必填）」並加 `aria-required`。原本的「主題或關鍵字」併入這一欄。
5. **怎麼練**：四排 SegmentedControl：程度（考試類改「目標程度」）、長度、形式（**預設獨白**，不再隨情境自動切換）、口音。
6. 說明文字 → primary「生成文字 →」。必填的類別名稱或描述還沒填時按鈕停用，下方一行 ink-muted 說明缺什麼。

生成後回到文字表單：標題與文字都可以修改，再斷句並翻譯。

## 對話的說話者 `SpeakerToggle`（D57）

- 預覽和編輯的句子清單中，對話的每句在編號下方有一個 secondary、sm、固定寬度的按鈕，顯示「A」或「B」，按一下切換；螢幕閱讀器讀作「第 N 句由 A 念，按一下切換」。
- 聲音區塊：font-medium 的「A 的聲音」→ VoiceMenu →「B 的聲音」→ VoiceMenu → supporting、ink-muted 的說明。不是對話時只有一個 VoiceMenu，和原本相同。

## 官方教材 `/admin/official`（D80）

- 入口：管理員的頁首導覽（「後台」左邊的「官方教材」，一般使用者看不到），以及後台導覽第二項。
- 頁面：h1「官方教材」＋右側 primary「＋ 建立新官方教材」（`/materials/new?official=1`）→ 說明 → 類別篩選（連結樣式同 FilterChip，`aria-current` 標示目前的類別，網址 `?cat=`）→「批次重新產生講解」Card → 「草稿（N）」「已發布（N）」兩區。
- 每份教材：標題連結＋ supporting、ink-muted 的「分類 · 情境 · N 句 · 講解：最新版／舊版 · 音檔 3 / 12」→ 副標 → `MaterialControls`（狀態、推薦順序、分類、簡介）；不是自己建立的，加一行 metadata 說明「編輯要由建立者進行」。
- **批次重新產生講解**：列出講解不是最新版的教材（checkbox，預設全選）→ 說明使用批次額度 → primary「重新產生講解（N 份）」→ 進行中顯示 ProgressBar「正在處理『標題』」；停止時 error 文字說明哪一份、為什麼（額度用 `UsageLimitMessage`）。全部是最新版時只顯示一行 ink-muted 說明。
- **我的教材的「複製為官方教材」**（管理員才有）：ghost、sm 按鈕；完成後 success「已複製到官方教材（草稿），這份練習保留不變。」＋「前往官方教材 →」。

## 後台公開教材（D58、D80）

- 原本的「教材管理」改名「公開教材」，只列一般公開與已下架的練習（官方教材移到上一節的頁面），篩選狀態是全部／公開中／已下架；控制列只保留分類（`MaterialControls` 的 `manageOfficial={false}`）與下架、恢復。

## 後台教材管理（D58）

- 篩選列同操作紀錄。清單每項依序是：
  - 標題連結（font-medium）和 supporting、ink-muted 的資訊（作者、日期、句數、分類）；
  - 狀態：公開或私人用 ink-muted，下架用 error，未完成時加上音檔進度；
  - 控制列（supporting）：「官方教材」下拉（不是官方／草稿（私人）／已發布）。已發布的會顯示「推薦順序 3/12」和 ghost、sm 的 ↑ ↓，自己建立的會有 accent-ink「編輯 →」；
  - 分類列：類別、情境、程度三個小下拉，加上 secondary、sm 的「儲存分類」；
  - 簡介列（D71）：「卡片簡介」標籤＋輸入框（高 32px、觸控 44px，最多 60 字，最小寬 15rem）＋下方 metadata、ink-muted 說明；右側 secondary、sm「儲存簡介」（沒改時停用）和 ghost、sm「用 AI 重新產生」；
  - 下架控制（同檢舉審查，不含駁回），或下架後的「恢復」。

## 播放速度 `SpeedControl`（D73）

- 只出現在音檔教材的聽寫與跟讀頁，播放區正下方：supporting、ink-muted「播放速度」＋ SegmentedControl「0.75× / 1× / 1.25×」（原生 radio，名稱「播放速度」，每個選項最小寬 56px）。
- 聽寫頁同一行（可換行）再加 metadata、ink-muted 的「慢速作答以 90% 計分，快速以 105% 計分（最高 100%）」，跟讀頁不顯示（沒有分數）。
- 結果畫面（聽寫完成、第 7 天週結果）：ScoreBadge 顯示加權分數；下方一行 `Tag`「慢速完成」或「快速完成」＋ supporting、ink-muted「原始正確率 100%」（和加權不同時才顯示）。全程 1× 時不顯示這一行。

## 學習分析 `/stats` 與圖表（D75）

- 頁面：h1「學習分析」＋說明 → 數字卡片（`StatTile`，手機兩欄、1024px 以上四欄：連續練習、近 7／30 天練習分鐘、開始過的教材、通過的教材）→ 圖表卡片，間距 32px。未登入顯示登入卡片（`ProgressGate`）。導覽列「學習進度」右邊的「學習分析」只在登入後出現。
- **圖表外框 `ChartFrame`**：Card（surface、1px line、4px、內距 24px）。Display h3 標題（`figure` 的名稱），右側可放控制（每日時間的「週 / 月」SegmentedControl）。圖的區塊是 `role="img"`，名稱就是下方的一句摘要（figcaption、supporting、ink-muted）。最下方 accent-ink「▸ 查看資料表」`<details>`，表格列出每個數值（數字欄靠右、等寬）。沒有資料時只顯示 ink-muted 說明。
- **顏色**：只用設計系統的 tokens。主要數列一律 `accent`；對照數列（原始正確率、第 1 天）用 `ink-muted`，並加第二種區分方式（虛線、淺色長條＋直接標數字），所以不只靠顏色。80% 門檻是 1px ink 虛線。格線 1px `line`；文字一律 ink／ink-muted，不用數列顏色。
- **圖表種類**（用 HTML 繪製，文字在手機上維持 metadata 12px；只有趨勢線是 SVG，線寬固定 2px）：
  - `ColumnChart`：每日時間、全站活躍人數。長條間距 2px、上緣 4px 圓角、左側 0／一半／最大三條刻度、只標最高那根的數字；滑鼠移上去（`title`）顯示該天數值。月檢視每 5 天標一次日期。
  - `TrendChart`：正確率趨勢，0～100%，點 10px（2px surface 外框），每個點的 hover 顯示日期、教材、第幾天與分數；加權和原始完全相同時只畫一條。
  - `PairedBars`：每份教材兩條（第 1 天、第 7 天），右側寫出百分比，80% 虛線。
  - `BarList`：最常聽錯的字（`lang="en"`）、分類、程度；左側標籤、中間長條（band 底軌）、右側數字。
- 後台總覽 `/admin` 也用 `ColumnChart` 顯示近 30 天活躍人數，另有「學習」數字組：平均每日練習分鐘、平均正確率（加權／原始）。

- **單字測驗（D136）**：三個 `StatTile`（測驗次數、平均正確率、已掌握單字）所有方案都看得到；正確率趨勢沿用 `TrendChart`，只有一條線（兩條線相同時圖例只顯示一條），虛線是 80%，屬於完整分析。

## 付費方案卡片 `PaidPlanCard`（D72）

- 免費方案的試用用完（或付費方案本月用完）時，`/materials/new` 用這張卡片取代建立表單，不會開始任何 AI 步驟。
- Card（surface、1px line、4px、內距 24px，寬度上限 720px），由上到下、間距 16px：
  - ink-muted 一行原因（`plans.limits.*`，例如「免費方案可以試做 1 份自己的教材，你已經用完了。」）；
  - Display h2「付費方案」（section 的 `aria-labelledby`）；
  - 三行內容，每行前面 success 色「✓」（`aria-hidden`）：每月份數、每份字數（數字來自 `PLANS.paid`）、所有官方教材與功能；
  - Display h3「價格：即將推出」；
  - primary、md「加入等候名單」；加入後換成 success「✓ 已加入等候名單……」（`aria-live`），重新整理仍顯示已加入；失敗時 error 文字（`role="alert"`）；
  - supporting、ink-muted 說明目前的免費方案內容。

## 法律頁面 `LegalPage`（D60）

- 服務條款與隱私權政策共用：h1 → supporting、ink-muted 的更新日期 → 前言 → 每一節 h3 標題＋ ink-muted 段落或項目清單 → 最下方「有疑問請使用 意見回饋」（accent-ink 底線連結）。

## 使用提示 `UsageNotice`（D60）

- 位置和樣式同登入結果提示：頁首下方整條 band 底、下方 1px line。左邊是 supporting、ink-muted 的文字，其中「服務條款」「隱私權政策」是 accent-ink 底線連結；右邊是 ghost、sm 的「知道了」。每台裝置只顯示一次。

## 意見回饋 `/feedback`（D60）

- h1 → 說明 → 「類型」下拉 →「內容」文字框（上方有提示）→ primary「送出」。送出後內容會清空，並顯示 success 色的「已送出」；失敗時顯示 error 色的訊息。
- 後台：清單每項是 ink-muted 的時間、類型、使用者（或「未登入」）、狀態 → 內容（保留換行）→ 來源頁連結 → 「標示為已處理」（secondary）或「改回未處理」（ghost）。

## 帳號頁（D60 補充）

- 「刪除帳號」上方新增一節 h2「下載我的資料」→ 說明 → accent-ink 底線連結「下載我的資料（JSON）」。
- 頁面最下方的連結：隱私權政策 · 服務條款。

## 新手引導（D61）

- 首頁標題下方、練習日曆上方：surface 卡片（1px line 邊框、4px 圓角、內距 24px）→ Display h3「第一次來？這樣練」→ 三欄（split 以上；手機堆疊）：metadata 大寫 accent-ink 的「第 1 天」→ font-medium 標題 → supporting、ink-muted 說明 → supporting、ink-muted 補充 → primary「從推薦的第一份開始 →」＋ ghost「略過」。

## 404 與錯誤頁（D61）

- 404：metadata 大寫「404」→ h1「找不到這一頁」→ ink-muted 說明 → primary「回首頁 →」＋ ghost「回報問題」。
- 錯誤：h1 → ink-muted 說明 → supporting 錯誤代碼 → primary「再試一次」＋ ghost「回首頁」。

## 骨架畫面 `Skeleton`（D61）

- band 色的圓角方塊，形狀接近即將出現的內容，緩慢明暗變化；系統設定減少動態效果時不動。螢幕閱讀器只會讀到一行「載入中…」。

## 跳到主要內容（D61）

- 平常隱藏，按第一次 Tab 時出現在左上角：surface 底、ink 文字、4px 圓角、陰影，按 Enter 跳到主要內容。

## App 圖示與品牌素材（D64）

- 圖示：ink 底的方形（啟動器自己套圓角或遮罩），ground 色、粗 46/512 的開口圓弧（約 300°，圓頭），開口處一個 accent 圓點。所有內容在中心半徑 205/512 的安全區內。
- 原始檔 `brand/icon.svg`，用 `node scripts/brand-assets.mts` 產生各尺寸，不要手動編輯 PNG。
- Play 商店主題圖片：ground 底，左邊是 48px 圓角的圖示，右邊是 Display 字體的「ListenLoop」和 ink-muted 的副標「7 天聽力循環 · Hear every word」。

## 離線頁 `/offline`（D64）

- h1「目前沒有網路」→ 兩段 ink-muted 說明 → primary「再試一次」（回首頁）。

## 螢光筆 `Mark`（D66）

用來標出學習者聽錯的地方和每句的重點。兩種標示**不只靠顏色**：底線樣式不同，而且都有螢幕閱讀器文字。

| 標示        | 用途                                 | 淺色                   | 深色                   | 底線       | 螢幕閱讀器       |
| ----------- | ------------------------------------ | ---------------------- | ---------------------- | ---------- | ---------------- |
| `mark-miss` | 你聽錯或漏掉的字（聽寫、跟讀、講義） | 底 #FFD2B5、線 #A63D09 | 底 #5E2A0E、線 #FF8F52 | 2px 實線   | 「你聽錯的字：」 |
| `mark-key`  | 每句 1～2 個重點字或片語             | 底 #FFF0A3、線 #6B5A00 | 底 #47400C、線 #E8D36A | 2px 點狀線 | 「重點：」       |

- 文字一律是 ink，對比在兩種模式都超過 AA（axe 檢查通過）。
- 連續的字標成一段，讓螢幕閱讀器只讀一次標籤。
- 列印：改用很淡的底色（miss #FFE3D1、key #FFF6C7）加上底線，並設定 `print-color-adjust: exact`，黑白印表機也能靠底線區分。
- 需要說明時，在區塊上方放 `MarkLegend`（兩個樣本加名稱）。
- 範例：`/styleguide` 的「Mark (highlighter)」，淺色和深色並排。

## 句子講解 `SentenceExplanation`（D68）

- 聽寫：寬螢幕在右側 w-80 的固定欄，內容超過畫面高度時可以捲動（可用鍵盤聚焦）；窄螢幕在按鈕下方。跟讀（自建練習）：在句子下方。上方都有 1px line 分隔。
- 第一行：難度標籤（1px line 框、supporting 字級，例如「難度：困難」）＋ MarkLegend。
- 「你這句聽錯的地方」：1px line 框、4px 圓角、內距 16px 的區塊，font-medium 標題 → 聽錯的字（miss 標示，用「·」分隔）→ 相關的單字、文法、連音。
- 其他區塊的標題都是 metadata 大寫、ink-muted：重點、句子結構與逐段意譯、為什麼難聽懂、單字與片語、文法。
- 意群：窄螢幕上下排；split 以上兩欄（7rem 角色欄＋內容），角色寫成「［主要子句］」；英文在上、中文在下（ink-muted）。
- 單字：font-medium 單字＋ ink-muted 音標、詞性、種類＋中文；下一行是搭配詞；例句英文在上、中文在下。
- 文法：font-medium 句型 → 說明 →「句中：」＋引用（聽錯的字有標示）→ 例句 →「常見錯誤：」。

## 講義的標示（D68）

- 句子清單上方：MarkLegend ＋ supporting、ink-muted 的說明（第 1 天聽錯的字）。
- 每句：英文（miss、key 標示）→ 中文 → 困難句的意群（［角色］英文 中文）→「為什麼難聽懂：」連音。
- 單字表第一欄加上音標，中文欄加上搭配詞，例句欄加上中文。

### 方案與價格 `/pricing`（D85）

- h1「方案與價格」→ 說明（ink-muted）→ 32px 後依序是：
  - 測試模式提示：只有假的供應者才有，1px line 邊框、surface 背景、supporting 字級；
  - 月繳／年繳的 `SegmentedControl`，右邊用 `Tag` 顯示「省 17%」；
  - 兩張方案卡片：寬螢幕並排，手機上下排列。外觀與 `PaidPlanCard` 相同（1px 邊框、base 圓角、surface 背景、p-6），付費卡片用 accent 邊框；
  - 注意事項清單：自動續訂、7 天退款；
  - 「退款政策 · 服務條款」連結。
- 卡片內容：
  - 標題：Display h2；
  - 價格（`PlanPrice`，D128，所有顯示訂閱價格的地方都用它）：**最大的數字一律是每月價格**，Display h2「NT$124」＋ ink-muted「／月」；年繳時下一行 supporting、ink-muted「年繳 NT$1,490，一次付清，」＋ success 色「省 2 個月」。第二個價格（班級方案的等候名單價、對話框）用 `size="md"`（Display h3）；表格與帳號頁用 `size="inline"`：「NT$124／月（年繳 NT$1,490）」；
  - 功能清單：✓ 用 success 色；
  - 動作：「訂閱」是 primary 按鈕；未登入時顯示文字說明；已是付費方案時顯示「管理訂閱」。

### 方案與付款（帳號頁 `#billing`，D85）

- 位置在「帳號」頁的同步說明之後，章節樣式和其他區塊相同（上方 line 分隔線、h2）。
- **方案**：
  - 「目前方案」用 supporting、ink-muted，下一行是方案名稱與付款週期，再下一行是價格（`PlanPrice` inline，D128）；
  - 測試付款加上 `Tag`「測試」。
- **狀態說明**：
  - 有效：「下次扣款日：…」；
  - 已取消續訂：「付費方案用到 …」；
  - 扣款失敗：error 色，`role="alert"`；
  - 已結束：ink-muted。
- **取消續訂**：secondary 按鈕，下方用 supporting 說明取消後的效果。
- **付款紀錄**：表格，欄位是日期、金額、狀態；字級 supporting、列之間用 line 分隔；金額用 `tabular-nums`。

### 營收 `/admin/revenue`（D85）

- h1 旁邊用 `Tag` 標示「測試」→ 四個 `StatTile`（訂閱中、每月經常性收入、本月淨收入、本月退款）→「訂閱」表格 →「最近的付款」表格。
- 退款按兩次確認：先按「退款…」，再按「確定退款 NT$149」，兩個都是 sm 按鈕。
- 模擬按鈕（續訂、扣款失敗、到期）只在假的供應者時顯示。

### 頁首與頁尾在手機上（D86）

- 手機（`split` 以下）的頁首只有導覽連結、「建立練習」、語言切換和帳號。主題切換（跟隨系統／淺色／深色）放到頁尾連結下面，寬螢幕仍在頁首。
- 觸控裝置（`pointer-coarse`）不顯示鍵盤快捷鍵提示。
- 文字連結如果不在段落裡（例如影片出處的 `dl`），點擊範圍至少 24 px（`inline-block py-1`）。

## 公開教材預覽 `SharedPreviewPage`（D106）

- 版面和影片頁相同（`max-w-content`）：返回「公開教材」、標籤「公開教材預覽」、雙語標題（`MaterialTitle`）、副標題、類別與程度（`Tag`），下一行是長度 · 口音 · 句數（supporting、ink-muted）。
- 「前 N 句（共 M 句）」是 h2，每句英文（body，`lang="en"`）下面是中文（supporting、ink-muted），句子之間用 `border-line` 分隔，寬度 `max-w-reading`。
- 升級區塊是一張 surface 卡片（`rounded-base border border-line p-6`）：說明哪些內容要升級後才開放，下面是「試聽第 1 句」（secondary，`aria-pressed`）和「升級即可練習這份教材 →」（primary 的 `ButtonLink`）。
- YouTube 教材顯示影片播放器（`VideoPlayerPanel`），不另外提供試聽按鈕。
