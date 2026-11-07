# 開發路線圖

剩下的工作依 a → f 的順序進行，一項做完才做下一項（2026-10-30 Joe 決定）。工作規則見 CLAUDE.md「給 Claude 的工作規則」，規格沒寫到的細節記在 `docs/decisions.md`。

**接續進度**：開新對話時，先讀 CLAUDE.md 和這份文件，從「進度」表第一個不是「完成」的項目接著做。每合併一個 PR，就更新這份表。

## 新產品方向（2026-11-08，Joe 指定，plan mode 規劃後執行）

依序做，每項一個 PR（D70 起）：

- [x] 1. 教材庫（#100）：影片和音檔合成一個教材庫；複選篩選（類型、分類、程度、長度、口音）存在網址；「我今天有幾分鐘？」；搜尋標題與副標；四種排序；手機底部抽屜、桌面側欄；統一的教材卡片；首頁順序（D70）
- [x] 2. 教材副標：AI 自動產生、後台可編輯、14 份草稿補上，花費 US$0.0019（#101，D71）
- [x] 3. 方案（#102）：免費試用 1 份自建教材、付費每月 30 份 × 2,000 字（集中設定）；`profiles.plan`；等候名單（D72）
- [ ] 4. 音檔調速（0.75×／1×／1.25×）與加權正確率；第 7 天門檻用加權分數（D73）
- [ ] 5. 練習時間記錄（只算前景、2 分鐘沒動作不算）（D74）
- [ ] 6. 學習分析頁 `/stats` 與後台的全站分析（D75）
- [ ] 7. 手機逐頁檢查與 UI 統一，整理前後差異

## 講解升級（2026-11-08，Joe 早上指定，晨間報告的其他事項之前）

- [x] 1. 螢光筆樣式加進設計系統與 `/styleguide`（#96，D66）
- [x] 2. 講解第 2 版：依難度調整、音標、搭配詞、例句中文、文法常見錯誤、結構拆解、連音；快取 v2；費用估算（#97，D67）
- [x] 3. 講解畫面：聽錯的地方排最前面並標示（聽寫、跟讀、講義與 PDF），每句重點（#98，D68）
- [x] 4. 官方草稿的講解升級到第 2 版：13/14 完成，花費 US$0.3875（#99，D69）
  - [ ] 「Study Plans for the Midterm」等每日費用上限重設後補跑（`UPGRADE_YES=1 npm run notes:upgrade`，約 US$0.02）
- 一般使用者自建的教材不自動升級（之後再決定）。

## 晨間報告（2026-11-08）

夜間任務全部完成，P0、P1、P2 共 17 個 PR（#78～#94），每個都通過本機五項檢查、E2E 和 CI 後才合併。正式站最後檢查也都正常。

### 1. 完成了哪些

**P0｜帳號、管理員與待辦收尾**

- [x] 管理員與角色：資料庫角色、ADMIN_EMAILS 自動成為管理員、後台可以指定其他管理員；使用者編號（你的一般帳號是「使用者 001」）（#78，D50）
- [x] 環境變數耐錯（全形轉半形、轉小寫）（#79，D51）
- [x] 跟讀 100% 彩帶（和聽寫共用）、連續 5 次低於 50% 的排查對話框、問題句子紀錄（#80，D52）
- [x] 刪除筆記本：頁面、程式、測試、資料表（#81，D53）
- [x] VoiceMenu 換上建立與編輯練習（#79，D51）
- [x] roadmap f：方案限制的集中設定（#82，D54）
- [x] 使用者操作紀錄：12 種事件，只有管理員能讀，保留 180 天（#83，D55）

**P0｜管理員後台 /admin**

- [x] 總覽、使用者管理（角色、停用／恢復、操作紀錄）、教材管理、檢舉審查、容易出錯的句子、API 用量與設定診斷、操作紀錄篩選、管理稽核（#84、#86，D56、D58）
- [x] 另外加上意見回饋與錯誤紀錄（#87、#91）

**P0｜教材分類與 AI 建立教材**

- [x] 分類集中設定：11 類＋考試（托福、雅思、多益、全民英檢，各有題型與目標程度）（#85，D57）
- [x] AI 建立教材：類別、子情境、程度、長度、對話或獨白、口音；**對話可以為兩個角色選不同聲音**（文字用 A:／B: 標記）（#85，D57）
- [x] 教材管理：官方教材草稿／已發布、推薦排序、分類、篩選；首頁推薦練習的類別與考試篩選（#86，D58）
- [x] 官方範例教材 **14 份草稿**（#89，D59，清單見第 3 點）

**P1**

- [x] 服務條款、隱私權政策更新、下載我的資料、刪除帳號（含音檔）、年齡提示、頁尾、意見回饋（#87，D60）
- [x] 新手引導、自訂 404 與錯誤頁、骨架畫面、axe 無障礙檢查（並修正兩個對比問題）、跳到主要內容、SEO（標題、Open Graph 圖片、sitemap、robots）、中英文完整性測試（#88，D61）
- [x] 效能：Lighthouse 手機首頁 60 → **95**、影片頁 64 → **98**、第 1 天聽寫 75 → **90**；無障礙和 SEO 都是 100（#90、#92，D62）
- [x] 安全：CSP（nonce）與安全標頭、速率限制、RLS 檢查（`npm run rls:check` 全部通過）、錯誤紀錄、備份腳本（#91，D63）

**P2**

- [x] PWA（可安裝、離線頁）、App 圖示與商店主題圖片、TWA 的 assetlinks、Google Play 商店資料草稿與上架步驟（#93，D64；`docs/play-store.md`、`docs/twa.md`）
- [x] 開發工具：自動續做腳本、3 個 skills（add-video、verify-prod、cost-report）、`docs/ai-dev-log.md`（#94，D65）

**沒完成或要你決定的**

- 自動續做**已建立但沒有安裝**：安裝到 `~/Library/LaunchAgents` 時被權限檢查擋下。這是合理的，背景常駐的設定應該由你決定。要用的話照第 6 點的步驟。
- 上架 Google Play、發布 OAuth 都需要你本人操作（第 6 點）。

### 2. 正式站的測試重點

**管理員帳號**

1. [首頁](https://listenloop-three.vercel.app)：頁首有「我的教材」「後台」，可以建立練習時還有「＋ 建立練習」。
2. [後台總覽](https://listenloop-three.vercel.app/admin)：使用者、活躍、練習、費用、Azure 額度、Supabase 用量都有數字。
3. [使用者](https://listenloop-three.vercel.app/admin/users)：看得到「使用者 000」（你）和「使用者 001」（一般帳號），點進 001 可以看操作紀錄。不要停用自己；可以試著把 001 設為管理員再改回來，然後到[管理稽核](https://listenloop-three.vercel.app/admin/audit)看紀錄。
4. [教材](https://listenloop-three.vercel.app/admin/materials?status=draft)：14 份官方草稿。點標題試聽，覺得可以就把「官方教材」改成「已發布」，用 ↑／↓ 排順序；再到首頁看推薦練習的類別篩選。
5. [建立練習](https://listenloop-three.vercel.app/materials/new) →「AI 生成」：選「考試聽力 → 雅思風格 → Part 1」、對話、英式，生成後在預覽步驟可以看到每句的 A／B，以及「B 的聲音」。（會用到真實 API，約 US$0.01）
6. [API 用量](https://listenloop-three.vercel.app/admin/usage)：設定診斷全部 ✓，按「測試連線（免費）」兩項都成功。
7. [錯誤紀錄](https://listenloop-three.vercel.app/admin/errors)、[意見回饋](https://listenloop-three.vercel.app/admin/feedback)：先送一則回饋，確認這裡看得到。

**一般使用者帳號（使用者 001）**

1. 無痕視窗打開[首頁](https://listenloop-three.vercel.app)：頁首下方有一次性的使用提示，首頁有新手引導；按「知道了」「略過」後重新整理，不會再出現。
2. 登入一般帳號：頁首有「我的教材」，打開後顯示「建立練習還沒開放」；沒有「後台」，打開 [/admin](https://listenloop-three.vercel.app/admin) 是 404。
3. 練一份影片的第 2 天跟讀：念對一句會有彩帶；故意亂念同一句 5 次，會跳出排查對話框，選「跳過這句並回報」，這句會顯示「已跳過」。（之後用管理員到[容易出錯的句子](https://listenloop-three.vercel.app/admin/sentences)可以看到這筆回報）
4. [帳號](https://listenloop-three.vercel.app/account)：「下載我的資料」會下載 JSON。（刪除帳號請用另一個測試帳號試）
5. 頁尾：[服務條款](https://listenloop-three.vercel.app/terms)、[隱私權政策](https://listenloop-three.vercel.app/privacy)、[意見回饋](https://listenloop-three.vercel.app/feedback)。
6. 手機 Chrome：選單「安裝應用程式」，可以安裝成 App；開飛航模式後打開會看到離線頁。

### 3. 官方教材草稿（14 份，都是私人草稿，只有你看得到）

| #   | 標題                                                                                                                                   | 類別                                | 程度・形式      | 長度               | 口音 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------- | ------------------ | ---- |
| 1   | [First Order at the Coffee Shop](https://listenloop-three.vercel.app/videos/p-94439aa3-7ec3-48ed-89ad-9a70ce985226)                    | 生活情境／咖啡店                    | 初級・對話      | 約 1.1 分（33 句） | 美   |
| 2   | [Checking In for a Flight Home](https://listenloop-three.vercel.app/videos/p-ff87bb4a-6294-4c89-8de1-9602df9e08cb)                     | 旅遊英文／機場報到與登機            | 初級・對話      | 約 1.2 分（25 句） | 英   |
| 3   | [Opening a Student Account](https://listenloop-three.vercel.app/videos/p-0ef050f7-30bd-4e49-9789-ddfdd02fb6c8)                         | 留學生活／開銀行帳戶                | 中級・對話      | 約 2.8 分（42 句） | 澳   |
| 4   | [Hiking or Night Market](https://listenloop-three.vercel.app/videos/p-e2ede85c-c7a2-4614-af18-0e58c9edc4ea)                            | 美式日常口語／週末計畫              | 中級・對話      | 約 2.3 分（29 句） | 美   |
| 5   | [Improving My Midterm Essay](https://listenloop-three.vercel.app/videos/p-2aa761f9-4342-4088-b55a-cd185cd879a9)                        | 校園學術／教授 office hours         | 中級・對話      | 約 3.0 分（34 句） | 印   |
| 6   | [Short Daily Listening and Student Confidence](https://listenloop-three.vercel.app/videos/p-1685838a-1298-43bc-a45e-177b9744d1f2)      | 學術寫作與發表／論文摘要            | 高級・獨白      | 約 2.0 分（16 句） | 英   |
| 7   | [Talking About a Team Project and Strengths](https://listenloop-three.vercel.app/videos/p-7a790f83-d241-4de0-9923-f54e99c493e6)        | 職場商務／求職面試                  | 中級・對話      | 約 2.1 分（32 句） | 澳   |
| 8   | [Campus Trial for Self-Driving Buses](https://listenloop-three.vercel.app/videos/p-6f395363-ce2a-46d3-9ac3-8d211dd2eee2)               | 新聞與時事／科技                    | 中級・獨白      | 約 1.8 分（14 句） | 美   |
| 9   | [The Small-Step Way to Beat Procrastination](https://listenloop-three.vercel.app/videos/p-d8f90c9f-c6f0-4265-977d-e910ddbff79b)        | 科普與知識／心理學                  | 高級・獨白      | 約 2.5 分（20 句） | 印   |
| 10  | [Finding My Voice in English](https://listenloop-three.vercel.app/videos/p-7c6db1a2-e298-4405-ac0e-b81b00060f0e)                       | 演講與故事／個人成長故事            | 中級・獨白      | 約 2.3 分（27 句） | 英   |
| 11  | [Surviving the Dry: Water Storage in Desert Plants](https://listenloop-three.vercel.app/videos/p-84ff0c51-5734-4300-b09c-d728295562c9) | 考試聽力／托福風格・學術講座：生物  | 約 100 分・獨白 | 約 2.4 分（22 句） | 美   |
| 12  | [Booking a Beginner Swimming Course](https://listenloop-three.vercel.app/videos/p-6402cf6e-6f59-46fd-a6d5-984572ac2923)                | 考試聽力／雅思風格・Part 1 日常對話 | Band 6.5・對話  | 約 2.6 分（26 句） | 英   |
| 13  | [Rescheduling the Client Meeting](https://listenloop-three.vercel.app/videos/p-c0002540-bce3-471c-a672-a70ee49749ff)                   | 考試聽力／多益風格・職場簡短對話    | 750 分・對話    | 約 1.6 分（21 句） | 澳   |
| 14  | [Study Plans for the Midterm](https://listenloop-three.vercel.app/videos/p-2afeab5b-6fc7-4579-9cb2-004018cf740c)                       | 考試聽力／全民英檢風格・簡短對話    | 中級・對話      | 約 1.4 分（23 句） | 美   |

對話的 A 是女聲、B 是同口音的男聲。審核方式：在「後台 → 教材」點標題試聽和看講義；要修改就按「編輯 →」；確定後把狀態改成「已發布」。

### 4. 實際花費（今晚的真實 API 額度 US$1.00）

| 項目                                                      | 呼叫次數 | 輸入 token | 輸出 token | 字元   | 費用            |
| --------------------------------------------------------- | -------- | ---------- | ---------- | ------ | --------------- |
| 驗證「測試連線」的判斷（Azure OpenAI 空對話，11-07 白天） | 1        | 0          | 0          | 0      | US$0            |
| 官方範例教材 14 份：AI 寫文字、斷句、翻譯、講解           | 121      | 50,410     | 44,976     | —      | **US$0.1026**   |
| 官方範例教材 14 份：Azure Speech 音檔                     | 367      | —          | —          | 26,677 | US$0（F0 免費） |
| **合計**                                                  |          | 50,410     | 44,976     | 26,677 | **US$0.1026**   |

- 本月用量合計（含你白天在正式站建立的練習）：US$0.1086；Azure 學生額度估計還剩約 US$99.89；F0 聲音本月用了 5.5%。
- 開發與所有自動測試都只用假的供應者和 fixture。之後可以用 `cost-report` skill 隨時查看。

### 5. 遇到的問題與需要你決定的事

1. **官方草稿的審核與發布**（上面第 3 點）。
2. **設計系統的兩個色票稍微調深了**：為了通過 WCAG AA 對比，淺色模式的 `accent-ink` 從 #B8440A 改成 #A63D09、`error` 從 #C2362B 改成 #B3302A（D61）。如果你想要別的色調，告訴我。
3. **App 圖示**：我依黑白橘畫了一個（循環弧線加上橘色圓點，`brand/icon.svg`，預覽見 `docs/store/feature-graphic.png`）。如果你想自己設計，規格寫在 D64。
4. **服務條款與隱私權政策是依常見做法寫的範本**，不是法律意見。正式收費或使用者變多前，建議請律師看過。
5. **年齡**：提示「未滿 18 歲請在家長同意下使用」，條款寫「未滿 13 歲請勿自行建立帳號」，Google Play 目標年齡建議選 13 歲以上（D60）。如果要開放一般使用者用 AI 建立練習，需要再評估。
6. **停用帳號**：停用後立刻無法登入，伺服器頁面也立刻不認得這個帳號；但瀏覽器已經拿到的存取權杖最長 1 小時內仍可同步自己的進度（D50）。一般情況足夠；如果要更嚴格，需要在每張表的 RLS 加上狀態檢查。
7. **自動續做要不要啟用**（第 6 點的 D）。
8. 下一步建議：
   - 先審核並發布官方教材，然後開始封閉測試；
   - 之後回到暫停中的內容工作（M3：Blender 影片、時間點校正）；
   - 或開放一般使用者建立練習（需要先決定方案與費用）。

### 6. 需要你親手做的事

**A. 審核官方教材**（約 30～60 分鐘）：見第 3 點。

**B. Google OAuth 發布（讓所有人都能用 Google 登入）**

1. 打開 https://console.cloud.google.com → 選 ListenLoop 專案 →「Google Auth Platform」（舊名「OAuth 同意畫面」）→「品牌宣傳」。
2. 填入：
   - 應用程式首頁：`https://listenloop-three.vercel.app`
   - 隱私權政策：`https://listenloop-three.vercel.app/privacy`
   - 服務條款：`https://listenloop-three.vercel.app/terms`
   - 使用者支援 email、開發人員聯絡資訊：你的 email。
3. **不要上傳 logo**：上傳 logo 會觸發品牌驗證，需要驗證網域擁有權，而 `vercel.app` 是 Vercel 的網域，你無法驗證。
4. 「目標對象」→「發布應用程式」→ 從「測試」改成「正式版」。只用 email、profile 這些基本權限，通常不需要 Google 審核。
5. 如果 Google 仍然要求驗證網域，就需要自訂網域（例如 listenloop.app，每年約 US$15～20，需要信用卡）。要的話告訴我，我會把設定步驟整理給你。

**C. Google Play 上架**（完整步驟與商店資料草稿見 `docs/play-store.md`、`docs/twa.md`）

1. 註冊開發者帳號：一次性 US$25，需要信用卡（依工作規則，要你同意）。
2. 準備一個公開的聯絡 email（會顯示在商店頁）。
3. 用 PWABuilder 打包 → 把兩個 SHA-256 指紋告訴我（不是秘密，可以貼在對話中），我會更新 `assetlinks.json`。
4. 封閉測試：至少 12 位測試者、連續 14 天保持加入（建議找 15～20 位）。
5. 申請正式版 → 送審。

**D. 自動續做（選用）**：照 `docs/auto-continue.md`：

```
scripts/auto-continue/install.sh
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.listenloop.auto-continue.plist
```

- 暫停：`launchctl bootout gui/$(id -u)/com.listenloop.auto-continue`
- 看紀錄：`tail -50 ~/Library/Logs/listenloop-auto/$(date +%Y-%m).log`
- 移除：`scripts/auto-continue/uninstall.sh`

**E. 每週備份**：`npm run db:backup`（存到 `backups/`，有個人資料，請存在加密的地方）。完整 SQL 備份與還原見 `docs/backup.md`。今晚已經跑過一次，在 `backups/` 裡。

## 進度

| 項目 | 內容                     | 狀態                                                                                    |
| ---- | ------------------------ | --------------------------------------------------------------------------------------- |
| a    | 小修正                   | 完成（PR #35）                                                                          |
| b    | M4 帳號                  | 完成（#38、#39、#40、b4 本 PR）                                                         |
| c    | 同時練習多部影片完整支援 | 完成（#42、c2 c3 本 PR；c2 沿用現有功能，見 D18）                                       |
| d    | 建立練習                 | 完成（#44～#49；d6 修改 #50～#54，2026-11-04 用真的 Gemini 和 Text-to-Speech 完整實測） |
| e    | 公開分享                 | 完成（e1 #55、手機頁首 #56、e2 本 PR）                                                  |
| e+   | e 驗收修正（14 項）      | 全部完成（#58～#81；3b、13 於 2026-11-07 完成，D51～D53）                               |
| f    | 方案限制的權限設定       | 完成（2026-11-07，D54）                                                                 |
| 夜間 | P0～P2 上線準備          | 完成（#78～#94，2026-11-07～08；見最上方晨間報告）                                      |
| —    | 內容工作                 | 暫停，功能都完成後一次處理                                                              |

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

## e+. e 驗收修正（2026-11-04 Joe 驗收 e 後提出，f 之前完成）

順序 1 → 2 → 3a → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 3b（3b 要等 Joe 在 `/styleguide` 確認 3a）。7～10 是 Joe 2026-11-05 加入的項目，同一次任務中不用等 Joe，依序做完（詳細見下方「7～10 的內容」）。

**6 的 PR 拆法**（2026-11-05 Joe 核准）：

1. 用量紀錄：每次呼叫記錄 token、字元數和估算費用，每日上限改用估算費用控制，管理員頁 `/admin/usage`；寫入省額度的測試規則。
2. Azure Speech 供應者。
3. Azure OpenAI 供應者。
4. 錄製 fixture、重新產生試聽範例、真實實測：要等清單 6 完成，而且 Claude 先回報預估的呼叫次數和費用、Joe 同意後才執行。

1～3 只用假的供應者，不需要等清單 6（2026-11-05 Joe 已完成清單 6：gpt-5-mini、UAE North、F0、預算警示）。

**真實呼叫額度**（2026-11-05 Joe 預先核准）：7～10 和 6 的整個任務合計 US$0.05，聲音只能用 F0 免費額度；只在最後用 1～2 句實測，fixture 重複使用。超過額度或需要重複呼叫時，先停下來問 Joe。已用：US$0.000792（2026-11-06 錄製 fixture：1,177 個輸入 token、249 個輸出 token；Azure Speech 817 字元，F0 免費；D41）。2026-11-07（14）：Joe 核准最多 1 次真實呼叫，用了 1 次免費的連線檢查（Azure OpenAI 空對話，HTTP 400，0 token，US$0；D49）。

**7～10 的內容**（Joe 2026-11-05）：

- **7 跟讀顯示講解**：自建練習的 Day 2～6 跟讀時，每句都顯示中文翻譯、單字和文法講解。
- **8 進度只在登入後顯示**：未登入時，首頁的今日任務、練習日曆、我的練習都改成提示登入；修改 D2，並記錄理由。
- **9 編輯自建練習**：
  - 可以改標題、Collection、公開／私人、句子（新增、刪除、合併、拆分、排序）、每句的翻譯、單字、文法，以及聲音；
  - 只重新產生文字有改動的句子；
  - 用版本機制，進行中的 7 天循環固定使用開始時的版本；
  - 只有作者能編輯。
- **9 和 10 的 PR 拆法**（2026-11-06）：
  1. 9a：每句各自保存講解；翻譯和講解的快取改成以一句為單位（D43，也是 10 的基礎）；
  2. 9b：版本機制：編輯時把舊版本存成快照，進行中的 7 天循環固定使用開始時的版本；
  3. 9c：編輯頁 `/materials/<id>/edit`：標題、Collection、公開／私人、聲音、句子（新增、刪除、合併、拆分、排序）、每句的翻譯、單字、文法，只重新產生改過的句子；
  4. 10：官方教材：管理員標記、推薦練習顯示、儲存空間估算。
- **10 官方教材資料庫**：
  - 管理員建立的教材可以標記成「官方教材」，出現在推薦練習，所有使用者都能練，不需要每個人重新產生；
  - 每一句的文字、音檔（Supabase Storage）、翻譯、單字、文法都永久存在資料庫，同一份內容只呼叫一次 API；
  - 翻譯和講解用「句子文字＋模型＋提示詞版本」當快取的鍵，相同的句子在任何教材都直接沿用；音檔用「句子文字＋聲音」當鍵；
  - 估算 Supabase 免費方案的儲存空間可以放多少分鐘的音檔，寫進 docs。

| 項目 | 內容                                                                  | 狀態                                     |
| ---- | --------------------------------------------------------------------- | ---------------------------------------- |
| 1    | 今日任務的自建練習打開是 404：未完成的練習改顯示「準備中」（D32）     | 完成（#58；test001 與 3 個無聲檔已刪除） |
| 2    | 斷句並翻譯、建立練習的百分比進度與目前步驟（D33）                     | 完成（#59）                              |
| 3a   | 聲音改成依口音分組的下拉選單，先放在 `/styleguide` 給 Joe 確認（D34） | 完成（#60），等 Joe 確認                 |
| 3b   | 建立練習改用聲音下拉選單                                              | 完成（2026-11-07，D51）                  |
| 4    | 用 Gemini 依語意斷句；預覽可以合併、拆分（D35）                       | 完成（#61；真實 Gemini 實測等清單 5D）   |
| 5    | AI 生成練習文字（類別、程度、長度、形式）（D36）                      | 完成（#62；真實 Gemini 實測等清單 5D）   |
| 6    | 聲音與 AI 文字的供應者改用 Azure；用量與費用紀錄（D37、D38）          | 完成（#65～#68；實測 US$0.000792，D41）  |
| 7    | 自建練習的跟讀：每句顯示中文、單字、文法（D42）                       | 完成（#69）                              |
| 8    | 進度只在登入後顯示（修訂 D2）                                         | 完成（#70）                              |
| 9    | 編輯自建練習（版本機制）                                              | 完成（9a #71、9b #72、9c #73；D43～D45） |
| 10   | 官方教材資料庫（推薦練習、句子層級快取、儲存空間估算）                | 完成（#74；D46）                         |
| 11   | 頁首加「我的教材」和管理員的「＋ 建立練習」，拿掉筆記本（D48）        | 完成（#76）                              |
| 12   | 建立練習判定為「沒有接上服務」：`/admin/usage` 加設定診斷（D47）      | 完成（#76）                              |
| 14   | 斷句一定退回規則、失敗紀錄加狀態碼、免費的測試連線（D49）             | 本 PR                                    |
| 13   | 跟讀動畫、語音辨識問題處理、刪除筆記本                                | 11、12 之後                              |

## f. 方案限制的權限設定

- **`lib/plans.ts`**：集中設定同時練習數、每月建立數、每篇字數，目前全部不限制。
- **`can(user, action)`**：程式一律透過它判斷能不能做；超過限制時，介面顯示的文字也統一放在這裡處理。
- **之後收費**：只要改設定，不用改功能程式碼。付費方案和金流不在這次範圍。

## 上線前待辦

- [ ] **開放建立練習給一般使用者之前**（D28）：Gemini API 條款要求使用者年滿 18 歲（付費方案也適用），也不能用在主要給未滿 18 歲的人使用的服務。要另外處理年齡，再更新隱私權政策。另外要重新估算 Chirp 3 HD 的聲音費用：免費額度每月 100 萬字元，是整個帳單帳戶共用的，使用者一多就會超過（D29）。
- [ ] **E2E 改成兩支正式影片**：Tears of Steel 上架後，把 `e2e/multi-video.spec.ts` 第二支練習改用正式影片（D18）。

- [x] **隱私權政策頁 `/privacy`**（b4 完成）：中英文版本，在 b4 製作。內容包括收集哪些資料（Google 帳號的 email、名稱和頭像，以及練習進度）、用途、存放位置（Supabase）、怎麼刪除帳號，以及聯絡方式。
- [ ] **隱私聯絡方式**（Joe 決定）：目前暫用 GitHub Issues（D17）。建議提供一個專用的聯絡 email，例如另外申請一個 Gmail，告訴 Claude 後替換。
- [ ] **發布 Google OAuth**（Joe 操作，b4 合併、`/privacy` 上線之後）：
  1. 到 Google Cloud Console，打開「Google Auth Platform → 品牌」，填入應用程式首頁 `https://listenloop-three.vercel.app` 和隱私權政策 `https://listenloop-three.vercel.app/privacy`，然後儲存。
  2. 到「目標對象」按「發布應用程式」，狀態會從「測試」改成「實際運作中」。只用到 email、profile、openid 這三個非敏感範圍，不需要 Google 審查。
  3. 發布前，只有加入「測試使用者」名單的 Gmail 可以登入。

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

### 5. 翻譯講解與聲音的 API 金鑰（d6 需要；5A、5B 已在 2026-11-03 完成）

需要兩把金鑰，**兩把都設好才會開放建立練習**。秘密金鑰不要貼進對話，直接填到 Vercel 和 `.env.local`。

#### 5A. Gemini API 金鑰（翻譯、單字、文法；免費，不用綁卡）

1. 用自己的 Google 帳號打開 https://aistudio.google.com ，第一次使用要同意服務條款。
2. 左側（或右上角）按「Get API key」→「Create API key」。
   - 選擇專案時，可以選第 2 步建立的 `ListenLoop`，也可以讓它自動建立新的專案；
   - 不需要設定帳單，維持免費方案。
3. 複製金鑰（`AIza…` 開頭）。
4. 加到 Vercel：「Settings → Environment Variables」，名稱 `GEMINI_API_KEY`，Environment 勾 Production 和 Preview，勾選「Sensitive」。
5. 在 `.env.local` 加一行 `GEMINI_API_KEY=你的金鑰`。

**要知道的條款**（2026-11-03 查 Google 官方條款）：

- 免費方案送出的內容，Google 可能用來改善產品，也可能經過人工審閱。隱私權政策和建立頁都已經說明，並提醒不要輸入個人資料。
- Gemini API 條款要求使用者年滿 18 歲，也不能用在「主要給未滿 18 歲的人使用」的服務。目前只有你（管理員）在用，沒有問題；**開放給一般使用者（可能包含高中生）之前要重新評估**，例如改用付費方案或限制年齡。已記在「上線前待辦」。

#### 5B. Cloud Text-to-Speech 金鑰（聲音；**要綁帳單，需要你明確同意**）

Text-to-Speech 就算只用免費額度，也一定要有帳單帳戶，也就是要信用卡。程式使用 Chirp 3 HD 語音（D29），免費額度每月 100 萬字元（以官方價格頁為準）；另外還有每日 20,000 字元的上限（D7）。

1. 到 https://console.cloud.google.com ，上方選擇 `ListenLoop` 專案。
2. 左側「帳單」→ 連結帳單帳戶，依照畫面加入信用卡。
3. 「帳單 → 預算與快訊」→ 建立預算：
   - 金額 US$1；
   - 快訊門檻 50%、90%、100%，通知寄到你的 email。
4. 「API 和服務 → 程式庫」，搜尋「Cloud Text-to-Speech API」→ 啟用。
5. 「API 和服務 → 憑證 → 建立憑證 → API 金鑰」，建立後按「編輯 API 金鑰」：
   - 「API 限制」選「限制金鑰」，只勾「Cloud Text-to-Speech API」；
   - 儲存。
6. 加到 Vercel：名稱 `GOOGLE_CLOUD_API_KEY`，Environment 勾 Production 和 Preview，勾選「Sensitive」。
7. 在 `.env.local` 加一行 `GOOGLE_CLOUD_API_KEY=你的金鑰`。

#### 5C. Gemini 預付額度（2026-11-03 新增；2026-11-04 Joe 已儲值 NT$150，自動儲值關閉）

5A 的專案已經連結帳單、升到 Tier 1 付費方案。付費方案預設是預付制：要先買額度，餘額是 0 時，所有請求都會回傳 HTTP 402（2026-11-03 實測就是這樣）。

1. 打開 https://aistudio.google.com ，左側「Billing」。
2. 按「Buy credits」，輸入金額（最低 US$5）。額度 12 個月後到期，一般不能退款。
3. 不要開啟 auto-reload。
4. 原本設定的 US$1 支出上限仍然有效：就算買了 US$5，一個月最多也只會用掉 US$1。
5. 完成後告訴 Claude「額度好了」。

不想付費的話，也可以把專案的帳單取消連結，改回免費方案；那樣隱私權政策要改回免費方案的寫法（內容可能被用來改善產品）。

#### 5D. 調高 Gemini 每月支出上限（2026-11-04 新增，**需要 Joe 操作**）

2026-11-04 測試語意斷句時，Gemini 回傳「Spend cap breached」：5C 設定的每月 US$1 支出上限已經用完。在調高之前，正式站的翻譯、講解都會失敗（斷句會自動退回規則斷句），AI 生成文字（e+ 5）也無法使用。

1. 打開 https://aistudio.google.com ，左側「Billing」（或「Usage & Billing」），選 ListenLoop 的專案。
2. 找到「Spend cap」（支出上限），把每月上限從 US$1 調高。建議 US$5：每日用量上限仍由程式控制（`lib/usage.ts`，語言模型每天 60,000 字元）。
3. 確認預付額度（Credits）還有餘額；auto-reload 維持關閉。
4. 完成後告訴 Claude「Gemini 上限調好了」，Claude 會用真的 Gemini 實測斷句和生成文字。

#### 完成後

- 告訴 Claude「金鑰好了」。Claude 會：
  - 用真的服務在 production 模式完整跑一次；
  - 產生 8 個聲音的試聽範例（d6e，已完成）；
  - 回報實際用量。
- 原本規劃的 Cloud Translation API 已經不需要（改用 Gemini，D28）；如果之前已經啟用，可以停用。

**想先試用畫面（選擇性）**：在 Vercel「Settings → Environment Variables」新增 `AI_PROVIDERS`，值填 `fake`，Environment **只勾 Preview**。之後的預覽網站就能用管理員帳號打開 `/materials/new`。翻譯會顯示成「[en] 原文」這種假的結果，音檔是無聲的，不會產生任何費用。正式站一律不會使用假的供應者。

### 6. Azure：聲音與 AI 文字（2026-11-05 新增，**需要 Joe 操作**）

Joe 使用 Azure for Students：US$100 額度，到 2027-11-04，不需要信用卡；額度用完時服務會停用，不會收費。程式改用 Azure 之後，Gemini（5C、5D）和 Cloud Text-to-Speech（5B）都只當備用。區域的理由見 D37。

**區域**：學生方案只允許 `uaenorth`、`indiasouthcentral`、`eastasia`、`centralindia`、`malaysiawest`（2026-11-05 Joe 實測，East US 2、Sweden Central 都被政策擋下）。查官方區域表（2026-11-05）的結果：

| 區域                | Azure OpenAI（Global Standard 的 gpt-5-mini） | Speech 神經語音 |
| ------------------- | --------------------------------------------- | --------------- |
| `uaenorth`          | 有                                            | 有              |
| `eastasia`          | 沒有                                          | 有              |
| `centralindia`      | 沒有                                          | 有              |
| `malaysiawest`      | 沒有                                          | 沒有            |
| `indiasouthcentral` | 沒有                                          | 沒有            |

所以**兩個資源都建在 UAE North**。

#### 6A. 資源群組

1. 登入 https://portal.azure.com ，確認「訂閱」裡有「Azure for Students」，並查看額度和到期日。
2. 搜尋「資源群組」→「建立」：
   - 訂閱：Azure for Students；
   - 名稱：`listenloop`；
   - 區域：**(Middle East) UAE North**。
3. 按「檢閱 + 建立」→「建立」。

#### 6B. Azure OpenAI（AI 文字：翻譯、講解、斷句、生成）

1. 搜尋「Azure OpenAI」→「建立」：
   - 資源群組 `listenloop`；
   - 區域 **UAE North**；
   - 名稱：例如 `listenloop-openai`（會變成網址的一部分，必須全球唯一，被用走時就加數字）；
   - 定價層 **Standard S0**（依用量計費，從學生額度扣）；
   - 網路：維持「所有網路」。
2. 建好後打開資源，按「前往 Foundry 入口網站」（或「Explore Azure AI Foundry portal」）。
3. 左側「部署」（Deployments）→「部署模型」→「部署基本模型」：
   - 模型選 **gpt-5-mini**；
   - 部署類型選 **Global Standard**；
   - 部署名稱填 `gpt-5-mini`；
   - 每分鐘 token 數（TPM）調到最低可用值，例如 10K。只有管理員在用，這樣就夠了，也能防止意外大量呼叫；
   - 按「部署」。
4. 如果出現「Quota insufficient」或「unusual activity」：
   - 改部署 **gpt-4.1-mini**，部署名稱填 `gpt-4.1-mini`；
   - 還是失敗，就告訴 Claude「OpenAI 部署不了」。AI 文字會繼續用 Gemini（`AI_LANGUAGE_PROVIDER=google`），聲音照樣改用 Azure。
5. 部署成功後，回到 Azure 入口網站的資源頁 →「金鑰和端點」，複製：
   - **端點**：`https://listenloop-openai.openai.azure.com/`；
   - **金鑰 1**：秘密金鑰，不要貼進對話。

**要知道的**：Global Standard 表示 Microsoft 可能在任何區域處理請求，所以資源建在 UAE North 也不會比較慢。依 Azure OpenAI 的條款，送出的內容不會被用來訓練模型，但會保留最多 30 天，用來偵測濫用。隱私權政策會在 PR 2 改寫。

#### 6C. Speech（聲音）

1. 搜尋「語音服務」（Speech services）→「建立」：
   - 資源群組 `listenloop`；
   - 區域 **UAE North**；
   - 名稱：`listenloop-speech`；
   - 定價層：一定要選 **Free F0**。每月 50 萬字元，超過就停止，不會收費；一個訂閱只能有一個 F0。
2. 建好後到「金鑰和端點」，複製：
   - **金鑰 1**：秘密金鑰；
   - **位置／區域**：應該是 `uaenorth`。

#### 6D. 填環境變數

Vercel「Settings → Environment Variables」，Environment 勾 Production 和 Preview，秘密金鑰勾選「Sensitive」；`.env.local` 也加上同樣的內容：

```
AZURE_SPEECH_KEY=（6C 的金鑰 1）
AZURE_SPEECH_REGION=uaenorth
AZURE_OPENAI_ENDPOINT=https://listenloop-openai.openai.azure.com
AZURE_OPENAI_API_KEY=（6B 的金鑰 1）
AZURE_OPENAI_DEPLOYMENT=gpt-5-mini
AZURE_OPENAI_MODEL=gpt-5-mini
```

- 6B 改用 gpt-4.1-mini 時，最後兩行都填 `gpt-4.1-mini`。
- 6B 部署不了時，`AZURE_OPENAI_*` 四行不用填，另外加 `AI_LANGUAGE_PROVIDER=google`。
- 程式要等 PR 2、3 合併才會讀這些變數，可以先填好。

#### 6E. 預算警示

1. 搜尋「成本管理 + 計費」→「成本管理」→ 上方「範圍」選 Azure for Students 訂閱。
2. 左側「預算」→「新增」：
   - 名稱：`listenloop-monthly`；
   - 重設期間：每月；
   - 金額：US$5；
   - 下一步「設定警示」：類型「實際」，門檻 50%、80%、100%，警示收件者填你的 email；
   - 建立。
3. 如果學生訂閱不能建立預算（選項是灰的或出現錯誤）：改到 https://www.microsoftazuresponsorships.com ，或在入口網站搜尋「教育」（Education）查看剩餘額度，再搭配 PR 1 的 `/admin/usage` 估算。

#### 完成後

- 告訴 Claude「Azure 好了」，並說明 6B 部署的是哪個模型。
- Claude 會先回報預計呼叫幾次、預估費用，**等你同意後**才：
  - 錄製測試用的 fixture；
  - 重新產生 8 個試聽範例（約 800 字元，F0 免費）；
  - 用 1～2 句實測，回報實際的 token 數、字元數和費用。
