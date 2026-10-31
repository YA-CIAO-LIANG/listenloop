# 影片候選清單

M3 擴充影片庫時從這裡接著做。每支都要確認：授權在官方頁面查到、YouTube 上傳者是權利人官方頻道（以頻道 ID 比對）、可以嵌入（oEmbed）、有和影片同一來源的英文字幕。Joe 已在瀏覽器確認（2026-10-26）：截取段落畫面上沒有燒入整句台詞、配樂不會蓋過對白。

## M3 進度

製作流程見 `docs/content-workflow.md`。兩個合集：「Blender 開放電影」與「NASA 科學」（2026-10-29 決定擴大來源：在 YouTube 找長度合適的 CC BY／公有領域影片，不拘泥於現有素材）。VOA 與美國國務院 Everyday Conversations **暫停**（資料保留在下方）。同一部片的片段可以重疊；每個片段至少 1 分鐘；題庫依片段長度篩選，段落規劃讓 8 個長度區間都有影片。一律標示出處。

**句子一律取自和播放的影片同一來源的字幕**：官方 `.srt` 字幕檔（確認與 YouTube 片長相同），或那支 YouTube 影片由上傳者提供的字幕（「顯示字幕記錄」，不可用自動產生的）。不用網站上的逐字稿頁：它可能和 YouTube 影片是不同版本（2026-10-28 VOA 的教訓，見「已排除」）。

| PR   | 內容                                                                  | 狀態  |
| ---- | --------------------------------------------------------------------- | ----- |
| M3-1 | 工具：草稿機制、時間點工具點按模式、`npm run video:new`、製作流程文件 | 完成  |
| M3-2 | `npm run video:new` 直接讀官方 `.srt` 字幕                            | 完成  |
| M3-3 | `npm run video:new` 讀貼上的 YouTube 字幕記錄                         | 完成  |
| M3-4 | 合集：資料加 `collection` 欄位，題庫依合集分組                        | 完成  |
| M3-5 | 片段長度：自動計算、至少 1 分鐘、題庫長度篩選；Sintel 延長到 15 句    | 完成  |
| M3-6 | Tears of Steel 重切：Part 1～3＋完整對白版（PR #35）                  | 本 PR |
| M3-7 | NASA 科學第一批：新合集、新類別「科學」、1～6 分鐘 7 支               | 待做  |
| M3-8 | NASA 科學第二批：6 分鐘以上 3 個長段                                  | 待做  |
| —    | Elephants Dream、Cosmos Laundromat、Sprite Fright                     | 之後  |
| —    | VOA、美國國務院 Everyday Conversations                                | 暫停  |

## Blender 開放電影全片清單（2026-10-29 依 [studio.blender.org/films](https://studio.blender.org/films/) 官方列表查證）

| 片名                            | 年份   | 英文對白                          | 授權（官方頁）                                                                              | 官方字幕檔                  | 可練習段數 | 結論                              |
| ------------------------------- | ------ | --------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------- | ---------- | --------------------------------- |
| Elephants Dream                 | 2006   | 有（Proog 與 Emo，全片）          | CC BY 2.5（orange.blender.org）                                                             | 無；YouTube 有官方英文字幕  | 約 3       | 收                                |
| Big Buck Bunny                  | 2008   | 無                                | CC BY 3.0（[peach.blender.org/about](https://peach.blender.org/about/)）                    | —                           | 0          | 不收（沒有對白）                  |
| Sintel                          | 2010   | 有（少）                          | CC BY 3.0                                                                                   | 有 `sintel_en.srt`（26 句） | 1          | 已上線；後面幾乎只剩「Scales!」   |
| Tears of Steel                  | 2012   | 有（多）                          | CC BY 3.0（mango.blender.org）                                                              | 有 `TOS-en.srt`（76 句）    | 4          | 收（真人演出＋CG）                |
| Caminandes 2: Gran Dillama      | 2013   | 無                                | —                                                                                           | —                           | 0          | 不收                              |
| Cosmos Laundromat               | 2015   | 有（Franck 與 Victor）            | CC BY 3.0（gooseberry.blender.org/license）                                                 | 無；YouTube 有官方英文字幕  | 約 3       | 收                                |
| Glass Half                      | 2015   | 無可用的英文對白                  | —                                                                                           | —                           | 0          | 不收                              |
| Caminandes 3: Llamigos          | 2016   | 無                                | —                                                                                           | —                           | 0          | 不收                              |
| Agent 327: Operation Barbershop | 2017   | 少                                | **CC BY-ND**（[官方 about](https://studio.blender.org/films/agent-327/pages/about/)）       | —                           | —          | **排除**（ND 不能改作）           |
| The Daily Dweebs                | 2017   | 無                                | —                                                                                           | —                           | 0          | 不收                              |
| Hero                            | 2018   | 無                                | —                                                                                           | —                           | 0          | 不收                              |
| Spring                          | 2019   | 無                                | CC BY 4.0（[官方 about](https://studio.blender.org/films/spring/pages/about/)）             | —                           | 0          | 不收                              |
| Coffee Run                      | 2020   | 無                                | —                                                                                           | —                           | 0          | 不收                              |
| Sprite Fright                   | 2021   | 有（一群青少年）                  | CC BY（官方頁寫「Attribution 1.0」）                                                        | 無；YouTube 有官方英文字幕  | 約 2       | 收                                |
| Charge                          | 2022   | 少                                | 官方頁查不到授權文字                                                                        | —                           | —          | 不收                              |
| Wing It!                        | 2023   | 幾乎沒有（貓和狗）                | CC BY 4.0（[官方 licensing](https://studio.blender.org/projects/wing-it/pages/licensing/)） | —                           | 0          | 不收（待 Joe 看片確認有沒有對白） |
| Singularity                     | 2026   | 無（官方寫明 no-spoken-dialogue） | CC BY（官方專案頁）                                                                         | —                           | 0          | 不收                              |
| Cowboi、Overgrown               | 製作中 | —                                 | —                                                                                           | —                           | —          | 之後再看                          |

## 段落與難度

難度分級標準：

- **語速**：用字幕時間算每秒幾個字；≤ 2 字／秒偏易，≥ 3 字／秒偏難。
- **句長與用字**：日常用字、短句偏易；抽象或少見的字偏難。
- **口音與音效**：口音重、配樂或音效蓋過人聲、多人搶話時往上調一級。
- 草稿產生後在 PR 附上每段語速與依據，由 Joe 決定最後分級。

### 段落規劃（依長度區間）

片段長度 = 第一句開始到最後一句結束（`lib/excerpt-length.ts`）。實際長度要扣掉片頭片尾音樂；拿到字幕記錄後先算長度，不合區間就換片或調整切點，PR 附上算出來的長度。

| 區間       | Blender 開放電影（官方 .srt）                                                            | NASA 科學（YouTube 字幕記錄）                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1～2 分鐘  | Tears of Steel · Part 1（字幕 1～14，1:55）                                              | Astronauts Describe Seeing Earth From Space（1:32，`iufG3-wrFHA`）；Parabolic Flights（1:55，`7YYP35EiiDE`）  |
| 2～3 分鐘  | **Sintel**（已上線，字幕 1～15，2:05）；Tears of Steel · Part 2（15～40，略過 21，2:17） | Dark Energy（2:43，`wLZo3mVAQSU`）                                                                            |
| 3～4 分鐘  | Tears of Steel · Part 3（41～76，略過 43、46、52～54、68，3:48）                         | Earth's Magnetosphere（3:38，`o4FSg-90XlA`）；What Would It Take To Say We Found Life?（3:27，`6SDVw1PYYcw`） |
| 4～5 分鐘  | —                                                                                        | Vision Changes in Space（4:11，`vDqLQGWh6v0`）                                                                |
| 5～6 分鐘  | —                                                                                        | What is the big bang?（5:50，`qsoLni0I5_U`）                                                                  |
| 6～7 分鐘  | —                                                                                        | Sitting Down with Astronaut Victor Glover · Part 1（19:52 的訪談截約 6.5 分鐘，`0qlVg1o_FJY`）                |
| 7～8 分鐘  | —                                                                                        | Victor Glover 訪談 · Part 2（再截約 7.5 分鐘，不重疊）                                                        |
| 8 分鐘以上 | Tears of Steel · 完整對白（1～76，略過同上，9:04）                                       | Our Alien Earth: The Lava Tubes of Mauna Loa（19:46 截約 9 分鐘，`cEyM2M1vAcw`）                              |

- Tears of Steel：粗話（第 21 句「Move your asses」、第 46 句「and a dick」）、只有尖叫聲的句子、義大利音樂術語「Vivacissimo!」（第 43 句）略過；第 9 句字幕含畫面文字「"Fourty years later"」，寫內容時拿掉；「Could'a」寫成「Could've」；都寫進 `changes`。斷成兩行的句子合併成一句，但中間停頓超過 2 秒就拆開（第 25｜26～27、60｜61、71｜72 句）。三個 Part 的句子與時間點都取自完整對白版（`excerptOf`），只校正完整版。
- 長片段（6 分鐘以上）是「挑戰版」，難度標 intermediate 以上；Tears of Steel 完整對白版（59 句）暫定 advanced，Part 1～3 暫定 intermediate。

### 待決問題

- **長片段的跟讀份量**（2026-10-29 記錄）：8 分鐘以上的片段約 50 句以上，Day 2～6 跟讀每天要念完全部句子，份量可能過重。等 Joe 實際試做後再決定是否調整（例如長片段的跟讀只念部分句子、或拆成每天一段）。目前規則不變。

## 授權規則

- 只用 **CC BY、CC BY-SA、Public Domain**。NC（禁止商業使用）與 ND（禁止改作）一律不用：ListenLoop 之後可能收費，中文翻譯屬於改作。
- 授權必須在**官方頁面**實際查到並記下網址；不憑記憶或第三方網站。
- 有版權的商業卡通一律不用。
- `lib/videos.ts` 的 `ALLOWED_LICENSE` 會在測試中擋下其他授權。

## 已上線

| 影片   | YouTube                                                    | 授權                                                     | 出處註明                                             | 逐字稿                                                                                         | 截取                   |
| ------ | ---------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------- |
| Sintel | [eRsGyueVLvQ](https://www.youtube.com/watch?v=eRsGyueVLvQ) | CC BY 3.0（[官方](https://durian.blender.org/sharing/)） | © copyright Blender Foundation \| durian.blender.org | [sintel_en.srt](https://durian.blender.org/wp-content/content/subtitles/sintel_en.srt)（官方） | 字幕 1～15，1:47～3:52 |

## Blender 開放電影：YouTube 與出處（CC BY）

官方 YouTube 頻道：`UCSMOQeBJ2RAnuFungnQOxLg`「Blender」（blender.org 連到 youtube.com/BlenderFoundation）、`UCz75RVbH8q2jdBJ4SnwuZZQ`「Blender Studio」（studio.blender.org 連到 @BlenderStudio）。

| 影片              | YouTube（頻道）                                                               | 授權（官方頁面）                                                                                                             | 出處註明（官方原文）                                                            | 逐字稿                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Elephants Dream   | [TLkA0RELQ1g](https://www.youtube.com/watch?v=TLkA0RELQ1g)（Blender）         | CC BY 2.5（[orange.blender.org](https://orange.blender.org/)）                                                               | 官方頁未指定格式，M3 時再確認；暫定「Blender Foundation \| orange.blender.org」 | YouTube 官方上傳的英文字幕（非自動產生，Joe 已確認）                                                                                       |
| Cosmos Laundromat | [Y-rmzh0PI3c](https://www.youtube.com/watch?v=Y-rmzh0PI3c)（Blender）         | CC BY 3.0（[gooseberry.blender.org/license](https://gooseberry.blender.org/license/)）                                       | (CC) Blender Foundation \| gooseberry.blender.org                               | YouTube 官方上傳的英文字幕（非自動產生，Joe 已確認）                                                                                       |
| Sprite Fright     | [\_cMxraX_5RE](https://www.youtube.com/watch?v=_cMxraX_5RE)（Blender Studio） | 官方頁寫「Creative Commons Attribution 1.0」（[官方](https://studio.blender.org/films/sprite-fright/pages/about)），屬 CC BY | (CC) Blender Foundation \| studio.blender.org                                   | YouTube 官方上傳的英文字幕（非自動產生，Joe 已確認）                                                                                       |
| Tears of Steel    | [R6MlUcmOul8](https://www.youtube.com/watch?v=R6MlUcmOul8)（Blender）         | CC BY 3.0（[mango.blender.org/sharing](https://mango.blender.org/sharing/)、[/about](https://mango.blender.org/about/)）     | 官方頁未指定格式，暫定「(CC) Blender Foundation \| mango.blender.org」          | 官方 [TOS-en.srt](https://download.blender.org/demo/movies/ToS/subtitles/TOS-en.srt)（76 句，含時間點；YouTube 片長 12:14 與官方版本相同） |

M3 待辦：

- Elephants Dream、Cosmos Laundromat、Sprite Fright 沒有官方字幕檔：從 YouTube 官方字幕（「顯示字幕記錄」，含時間）取得對白，字幕內容無法用程式讀取，需 Joe 在瀏覽器複製。
- Tears of Steel 有官方 `.srt`，直接用 `npm run video:new` 讀取。真人演出＋CG（非純動畫），Joe 同意使用。含粗話的句子（第 21 句「Move your asses」、第 46 句「and a dick」）與只有尖叫聲的句子切段時略過，並寫進 `changes`。
- Sprite Fright 官方頁的「1.0」可能是筆誤（其他片都是 3.0），不論版本都屬 CC BY；JSON 依官方原文填寫。

## NASA 科學（CC BY／公有領域，2026-10-29 查證）

- **官方頻道**：`UCKt6dYzHqHfpcp1lgj4bl1A`「NASA Science」（@NASAScience）。NASA 官方的 [nasa.gov/social-media](https://www.nasa.gov/social-media/) 列出 `youtube.com/user/ScienceAtNASA`，解析後就是這個頻道。
- **授權**：每支影片的 YouTube 頁標「Creative Commons Attribution license (reuse allowed)」（CC BY 3.0）。NASA 的 [媒體使用規定](https://www.nasa.gov/nasa-brand-center/images-and-media/)：NASA 的影音「generally are not subject to copyright」、要註明 NASA 是出處、不可暗示 NASA 替商品或服務背書；現任與前任太空人的姓名、肖像不可用於商業宣傳。JSON 填 `CC BY 3.0`，出處「NASA」。
- **行銷限制**：ListenLoop 的宣傳素材（商店截圖、廣告）不使用 NASA 標誌、太空人肖像或「NASA 合作」之類的字眼。
- **字幕**：候選影片都檢查過有 NASA 上傳的「English」字幕（不是自動產生的）；字幕內容仍需 Joe 從「顯示字幕記錄」複製。
- **類別**：新增 `science`（科學）。
- 只收 NASA Science 頻道上傳、由 NASA 製作的影片；畫面或聲音含第三方素材（例如新聞片段、商業音樂）的影片不收。NASAJPL Edu（JPL 由加州理工學院管理，部分素材有版權）暫不收。

## 暫停：VOA Let's Learn English（Public Domain）

2026-10-28 暫停（M3 先只做 Blender 開放電影合集）。以下資料保留，恢復時從這裡接著做。

授權：VOA 官方頁面 [learningenglish.voanews.com/p/6861.html](https://learningenglish.voanews.com/p/6861.html)：「Learning English texts, MP3s, photos and videos are in the public domain. You are allowed to reprint them for educational and commercial purposes, with credit to learningenglish.voanews.com.」（通訊社素材如 AP、Reuters、AFP 除外；以下皆為 VOA 自製課程。）

- 出處註明：`learningenglish.voanews.com`
- 官方頻道：`UCKyTokYo0nK2OA-az-sDijA`「VOA Learning English」（VOA 官網連到 youtube.com/voalearningenglish）
- **句子**：用 YouTube 影片本身的字幕記錄（Joe 從瀏覽器複製），不用官網逐字稿頁。待確認：字幕是 VOA 上傳的「English」，不是「English (auto-generated)」（Joe 抽查 Lesson 7）。
- `attribution.transcriptUrl` 填 YouTube 影片網址（字幕來源）。

| 課                               | YouTube                                                    | 主題                     |
| -------------------------------- | ---------------------------------------------------------- | ------------------------ |
| Lesson 6: Where Is the Gym?      | [zkEnsSVBfPM](https://www.youtube.com/watch?v=zkEnsSVBfPM) | 生活：在公寓大樓找健身房 |
| Lesson 7: What Are You Doing?    | [THMKsKMTyqg](https://www.youtube.com/watch?v=THMKsKMTyqg) | 職場：第一天上班見老闆   |
| Lesson 8: Are You Busy?          | [uHuChnbaw6k](https://www.youtube.com/watch?v=uHuChnbaw6k) | 職場：向忙碌的同事道歉   |
| Lesson 10: Come Over to My Place | [34LhID6vT1k](https://www.youtube.com/watch?v=34LhID6vT1k) | 生活：電話中指路到家     |
| Lesson 12: Meet My Family        | [ncA2an5c1_g](https://www.youtube.com/watch?v=ncA2an5c1_g) | 生活：想家時看家人照片   |

截取段落等拿到字幕記錄後再決定。

## 暫停：美國國務院 Everyday Conversations

2026-10-28 暫停，授權與格式仍待確認。以下資料保留。

- 來源：[americanenglish.state.gov](https://americanenglish.state.gov/resources/everyday-conversations-learning-american-english)（Office of English Language Programs）。
- 授權：美國聯邦政府作品原則上屬公有領域，但官網擋程式讀取（403），**尚未在官方頁面查到授權聲明**。Joe 在瀏覽器確認頁尾或 Copyright / Terms of Use 的文字後才能用。
- 格式待確認：可能只有 MP3＋PDF、沒有 YouTube 影片。若只有 MP3，需要先做「音檔來源」播放器（M3-7）。

## 已排除（記錄原因，避免重複查）

- VOA 2016 年舊版課程頁的逐字稿（2026-10-28）：Lesson 6、7、8、10、12 用它做成草稿（PR #28，已關閉），Joe 確認和 YouTube 影片「內容不同」，是不同版本。VOA 本身仍可用，改用 YouTube 字幕記錄。
- VOA「English in a Minute」（Sugarcoat 等）：官網沒有逐字稿（改用 YouTube 字幕記錄後可重新評估）；Actions Speak Louder Than Words 不在官方頻道。
- Blender「Agent 327: Operation Barbershop」：官方授權為 CC BY-ND（禁止改作）。
- Blender「Charge」：專案頁查不到授權文字，對白也很少。
- Blender「Wing It!」：授權已查到（CC BY 4.0），但幾乎沒有對白。
- VOA Let's Learn English Lesson 7（`THMKsKMTyqg`）：2026-10-29 檢查 YouTube 完全沒有字幕軌，字幕記錄的做法也行不通。
- 2016 年 3～4 月早期上傳與 2022 年兒童版的 Let's Learn English：影片編號與逐字稿頁不符（改用 YouTube 字幕記錄後可重新評估）。
