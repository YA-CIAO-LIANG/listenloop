# 影片候選清單

M3 擴充影片庫時從這裡接著做。每支都要確認：授權在官方頁面查到、YouTube 上傳者是權利人官方頻道（以頻道 ID 比對）、可以嵌入（oEmbed）、有和影片同一來源的英文字幕。Joe 已在瀏覽器確認（2026-10-26）：截取段落畫面上沒有燒入整句台詞、配樂不會蓋過對白。

## M3 進度

製作流程見 `docs/content-workflow.md`。素材：公有領域或 CC BY（Blender 開放電影、VOA Learning English、美國國務院 Everyday Conversations 等），一律標示出處，排除 AP、Reuters、AFP 素材。一部影片可以切成多段（每段約 10～12 句，各算一支）。目標 20～30 支。

**句子一律取自和播放的影片同一來源的字幕**：官方 `.srt` 字幕檔（確認與 YouTube 片長相同），或那支 YouTube 影片由上傳者提供的字幕（「顯示字幕記錄」，不可用自動產生的）。不用網站上的逐字稿頁：它可能和 YouTube 影片是不同版本（2026-10-28 VOA 的教訓，見「已排除」）。

| PR   | 內容                                                                  | 狀態  |
| ---- | --------------------------------------------------------------------- | ----- |
| M3-1 | 工具：草稿機制、時間點工具點按模式、`npm run video:new`、製作流程文件 | 完成  |
| M3-2 | `npm run video:new` 直接讀官方 `.srt` 字幕（文字與時間照字幕）        | 本 PR |
| M3-3 | `npm run video:new` 讀貼上的 YouTube 字幕記錄                         | 待做  |
| M3-4 | Tears of Steel 3 段                                                   | 待做  |
| M3-5 | VOA 5 段（用 YouTube 字幕記錄重做）                                   | 待做  |
| M3-6 | Elephants Dream、Cosmos Laundromat、Sprite Fright 共約 8 段           | 待做  |
| M3-7 | 美國國務院 Everyday Conversations（視授權與格式確認結果）             | 待做  |
| M3-8 | 影片庫依來源、程度、類別篩選                                          | 待做  |

## 授權規則

- 只用 **CC BY、CC BY-SA、Public Domain**。NC（禁止商業使用）與 ND（禁止改作）一律不用：ListenLoop 之後可能收費，中文翻譯屬於改作。
- 授權必須在**官方頁面**實際查到並記下網址；不憑記憶或第三方網站。
- 有版權的商業卡通一律不用。
- `lib/videos.ts` 的 `ALLOWED_LICENSE` 會在測試中擋下其他授權。

## 已上線

| 影片   | YouTube                                                    | 授權                                                     | 出處註明                                             | 逐字稿                                                                                         | 截取                   |
| ------ | ---------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------- |
| Sintel | [eRsGyueVLvQ](https://www.youtube.com/watch?v=eRsGyueVLvQ) | CC BY 3.0（[官方](https://durian.blender.org/sharing/)） | © copyright Blender Foundation \| durian.blender.org | [sintel_en.srt](https://durian.blender.org/wp-content/content/subtitles/sintel_en.srt)（官方） | 字幕 1～12，1:47～2:36 |

## 候選：Blender Foundation 開放電影（CC BY）

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

## 候選：VOA Let's Learn English（Public Domain）

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

## 候選：美國國務院 Everyday Conversations（待確認）

- 來源：[americanenglish.state.gov](https://americanenglish.state.gov/resources/everyday-conversations-learning-american-english)（Office of English Language Programs）。
- 授權：美國聯邦政府作品原則上屬公有領域，但官網擋程式讀取（403），**尚未在官方頁面查到授權聲明**。Joe 在瀏覽器確認頁尾或 Copyright / Terms of Use 的文字後才能用。
- 格式待確認：可能只有 MP3＋PDF、沒有 YouTube 影片。若只有 MP3，需要先做「音檔來源」播放器（M3-7）。

## 已排除（記錄原因，避免重複查）

- VOA 2016 年舊版課程頁的逐字稿（2026-10-28）：Lesson 6、7、8、10、12 用它做成草稿（PR #28，已關閉），Joe 確認和 YouTube 影片「內容不同」，是不同版本。VOA 本身仍可用，改用 YouTube 字幕記錄。
- VOA「English in a Minute」（Sugarcoat 等）：官網沒有逐字稿（改用 YouTube 字幕記錄後可重新評估）；Actions Speak Louder Than Words 不在官方頻道。
- Blender「Wing It!」「Charge」：專案頁查不到授權文字，對白也很少。
- 2016 年 3～4 月早期上傳與 2022 年兒童版的 Let's Learn English：影片編號與逐字稿頁不符（改用 YouTube 字幕記錄後可重新評估）。
