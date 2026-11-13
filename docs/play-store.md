# Google Play 上架準備（P2，D64）

> 依 2026-11-07 查到的規定整理；正式填寫前，請到 Play Console 確認最新的欄位與規定。

## 1. 商店資訊草稿

> 2026-11-13 起，最新版（含字數檢查與 ASO 關鍵字）在 `marketing/word/09-Google-Play商店資料.docx`（D168），由 `scripts/marketing/content/play-store.mts` 產生；改內容時以那份為準。

### 繁體中文（預設語言）

> 2026-11-12 依 ASO 關鍵字（`docs/marketing/aso.md`）改寫，並更新已改變的規則：通關條件改為「比第 1 天進步」、公開教材的完整練習是付費功能（D92、D106）。

- **App 名稱**（30 字以內）：ListenLoop：英文聽力練習｜7 天聽寫跟讀
- **簡短說明**（80 字以內）：英文聽力 7 天循環：聽寫找出漏聽的字、跟讀練語速，第 7 天看見自己聽懂多少。
- **完整說明**（4000 字以內）：

  ListenLoop 是給台灣學生的英文聽力練習。不是一次聽很多，而是把同一段英文練 7 天，練到每個字都聽得清楚——每天 10 分鐘的每日英文習慣。

  【7 天循環】
  ・第 1 天英文聽寫：逐句播放、打字，逐字對答案；聽錯的字用螢光筆標出，並說明為什麼難聽懂（連音、弱讀）。完成後看雙語講義：中英對照、英文單字、文法。
  ・第 2～6 天跟讀：聽一句、念一句，語音辨識告訴你漏念哪些字，順便練英文發音。
  ・第 7 天再聽寫一次，和第 1 天逐句比較，進步變成數字。
  ・聽錯的字會在 1、3、7 天後回來複習。

  【英聽教材】
  ・官方教材免費：生活英文、旅遊、留學英文、校園、職場、新聞、科普、演講，以及多益聽力、托福聽力、雅思聽力、全民英檢、學測英文風格的原創練習（模仿題型與難度，非真實考題，與考試主辦單位無關）。
  ・英文會話與獨白，有美式、英式、澳洲、印度口音。
  ・Blender 開放電影等創用 CC 授權影片，一律標示出處。
  ・付費方案：每月建立更多自己的教材、上傳自己的錄音建立教材、完整練習其他學習者分享的教材（目前尚未開放收費）。

  【其他】
  ・不用登入也能學英文；登入後手機和電腦同步進度、看學習分析。
  ・深色模式、背景主題、中英文介面。
  ・不放廣告，不販售資料；跟讀不錄音。

- **應用程式類別**：教育（Education）
- **標記**：語言學習
- **聯絡 email**：需要 Joe 提供一個公開的聯絡信箱（Play Console 必填，會顯示在商店頁）。
- **隱私權政策網址**：https://listenloop-three.vercel.app/privacy

### English

- **App name**: ListenLoop: English Listening Practice
- **Short description** (80 characters max): English listening in 7 days: dictate, shadow, and see how much more you hear.
- **Full description**:

  ListenLoop is English listening practice for learners in Taiwan. Instead of listening to a lot once, you practice one clip for seven days until you can hear every word: a daily English practice habit of about ten minutes.

  Seven-day loop
  • Day 1, dictation: type each sentence and check every word; missed words are highlighted with why they're hard to hear (connected speech, weak forms). Then read the bilingual handout with vocabulary and grammar.
  • Days 2–6, shadowing: say each sentence back; speech recognition shows which words you missed, which also helps pronunciation.
  • Day 7, dictation again: compare with Day 1, sentence by sentence.
  • Missed words come back 1, 3, and 7 days later (spaced repetition).

  Lessons
  • Free official lessons: everyday English, travel, study abroad English, campus, work, news, science, talks, and original TOEIC-, TOEFL-, IELTS-, and GEPT-style listening (format and difficulty only; not real test items, not affiliated with the test makers).
  • English conversation and monologues with US, UK, Australian, and Indian accents for accent training.
  • Creative Commons films such as Blender's open movies, always credited.
  • Paid plans: more lessons of your own each month, lessons from your own recordings, and full practice of lessons other learners share (not charged yet).

  Also
  • Learn English without signing in; sign in to sync between phone and computer and see your analytics.
  • Dark mode, background themes, Chinese and English interface. ESL-friendly.
  • No ads; we don't sell data; shadowing is never recorded.

## 2. 內容分級問卷（IARC）建議答案

- 類別：參考、新聞或教育類（Reference, News, or Educational）。
- 暴力、性、粗俗語言、受管制物質、賭博：無。
- 使用者互動功能：
  - 使用者可以分享內容（公開練習）：是。內容會經過檢舉與下架流程。
  - 使用者之間可以互相溝通：否（沒有訊息或留言功能）。
  - 分享使用者位置：否。
  - 數位購買：否。
- 預期分級：普遍級（IARC 3+／Everyone）。因為有使用者產生內容，可能顯示「使用者互動」標示。

## 3. 資料安全表單建議答案

依目前實際收集的資料（隱私權政策 2026-11-09 版，含付費方案，D85）：

| 資料類型                                               | 是否收集                                                                 | 是否分享給第三方 | 用途                                           | 是否必要                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------- | ---------------------------------------------- | ------------------------ |
| 個人資訊：電子郵件地址、名稱                           | 是（Google 登入）                                                        | 否               | 帳號管理                                       | 選用（不登入也能用）     |
| 個人資訊：使用者 ID                                    | 是                                                                       | 否               | 帳號管理、App 功能                             | 選用                     |
| App 活動：App 互動（操作紀錄）                         | 是                                                                       | 否               | App 功能、分析（服務改善）                     | 選用（只記錄登入使用者） |
| App 活動：使用者產生的內容（自建練習、意見回饋、檢舉） | 是                                                                       | 否               | App 功能                                       | 選用                     |
| 音訊：語音                                             | 否（不錄音；語音辨識由瀏覽器／裝置處理，只保存涵蓋率與回報時的辨識文字） | —                | —                                              | —                        |
| 裝置或其他 ID                                          | 否                                                                       | —                | —                                              | —                        |
| 當機記錄、診斷資料                                     | 是（伺服器錯誤紀錄，不含個人內容）                                       | 否               | App 功能                                       | 必要                     |
| 財務資訊：購買記錄（方案、付款週期、金額、日期、退款） | 是（開放付費方案後）                                                     | 否               | App 功能（付費功能、付款紀錄、退款）、法律遵循 | 選用（只有訂閱的人）     |
| 財務資訊：信用卡等付款資訊                             | 否（由付款服務收集，App 看不到完整卡號）                                 | —                | —                                              | —                        |
| 位置、聯絡人、相片                                     | 否                                                                       | —                | —                                              | —                        |

- 傳輸加密：是（HTTPS）。
- 使用者可以要求刪除資料：是（帳號頁可以直接刪除帳號，也可以下載資料）。
- 「分享」的定義：Supabase、Vercel、Microsoft Azure 是代為處理資料的服務供應商，依 Google 的定義不算「分享」。
- 付費方案：在 Play 上架的 App 內販售數位訂閱，要用 Google Play 帳款服務。Google 是交易的賣方，付款資訊由 Google 收集。網頁版的付款服務（Lemon Squeezy 或 Paddle，見 `docs/payments.md`）則是代表 ListenLoop 處理付款的服務供應商。付費方案開放前，表單上的「購買記錄」可以先填「否」，開放時再更新。
- 注意：語音辨識在 Android 的 Chrome 中，聲音會傳到 Google 辨識。這是瀏覽器的功能，App 本身不收集，但建議在說明中提到。

## 4. 商店截圖清單

規格：手機截圖 16:9 或 9:16，每邊 320～3840 px，長邊不超過短邊的 2 倍；至少 2 張，建議 4～8 張。建議用 1080×1920（直式）。平板（7 吋、10 吋）建議各 2～4 張，1600×2560。

1. 首頁：今日任務與練習日曆（登入狀態，有幾天完成紀錄）。
2. 第 1 天聽寫：一句答完後的逐字比對與分數。
3. 雙語講義：中英對照、單字、文法。
4. 跟讀：辨識結果與漏念的字（底線標示）。
5. 第 7 天結果：與第 1 天比較的進步。
6. 推薦練習：官方教材與類別篩選。
7. 深色模式的任一畫面。
8. 英文介面的任一畫面（英文商店頁使用）。

另外需要（已產生，`node scripts/brand-assets.mts` 可以重新產生）：

- 主題圖片（Feature graphic）：1024×500，`docs/store/feature-graphic.png`。
- App 圖示：512×512，`docs/store/play-icon-512.png`。

截圖的拍法：Chrome 開發人員工具 → 切換裝置工具列 → 選 Pixel 7（412×915，DPR 2.625）或自訂 1080×1920 → 右上角選單「擷取螢幕畫面」。建議用測試帳號，先練幾天，讓日曆和進度有內容。

## 5. 上架步驟與順序

1. **註冊 Google Play 開發者帳號**（Joe）：一次性 US$25，需要信用卡（依工作規則，要 Joe 明確同意）。個人帳號需要身分驗證，並驗證一支 Android 裝置。
2. **確認網址可以公開存取**：首頁、`/privacy`、`/terms`（已上線）。
3. **產生 Android App**：用 PWABuilder 打包成 Trusted Web Activity（見 `docs/twa.md`），取得簽署金鑰的 SHA-256 指紋，填進 `public/.well-known/assetlinks.json`，部署後確認可以開啟。
4. **在 Play Console 建立 App**：填商店資訊（上方草稿）、內容分級問卷、資料安全表單、目標對象（建議 13 歲以上；如果勾選包含 13 歲以下，需要遵守「家庭」政策，不建議）、廣告（無）。
5. **封閉測試**：2023-11-13 之後建立的個人帳號，申請正式版之前，必須進行封閉測試：至少 12 位測試者，連續 14 天保持加入。建議找 15～20 位，避免有人中途退出。
6. **申請正式版存取權**：回答測試心得問卷，等待審核（通常幾天）。
7. **發布正式版**：上傳正式版、送審。

參考：Google Play 說明「新個人開發者帳號的測試規定」https://support.google.com/googleplay/android-developer/answer/14151465
