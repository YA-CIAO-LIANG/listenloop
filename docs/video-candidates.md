# 影片候選清單

M3 擴充影片庫時從這裡接著做。每支都已確認：授權在官方頁面查到、YouTube 上傳者是權利人官方頻道（以頻道 ID 比對）、可以嵌入（oEmbed）、有官方英文逐字稿或字幕。Joe 已在瀏覽器確認（2026-10-26）：截取段落畫面上沒有燒入整句台詞、配樂不會蓋過對白。

## M3 進度

製作流程見 `docs/content-workflow.md`。第一個里程碑：20 支。

| PR   | 內容                                                                      | 狀態  |
| ---- | ------------------------------------------------------------------------- | ----- |
| M3-1 | 工具：草稿機制、時間點工具點按模式、`npm run video:new`、製作流程文件     | 本 PR |
| M3-2 | VOA Lesson 6、7、8、10、12                                                | 待做  |
| M3-3 | 再 8 課 VOA Let's Learn English（待查證）                                 | 待做  |
| M3-4 | Elephants Dream、Cosmos Laundromat、Sprite Fright＋3 課 VOA（合計 20 支） | 待做  |
| M3-5 | 影片庫依程度、類別篩選                                                    | 待做  |

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

| 影片              | YouTube（頻道）                                                               | 授權（官方頁面）                                                                                                             | 出處註明（官方原文）                                                            | 逐字稿                                               |
| ----------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Elephants Dream   | [TLkA0RELQ1g](https://www.youtube.com/watch?v=TLkA0RELQ1g)（Blender）         | CC BY 2.5（[orange.blender.org](https://orange.blender.org/)）                                                               | 官方頁未指定格式，M3 時再確認；暫定「Blender Foundation \| orange.blender.org」 | YouTube 官方上傳的英文字幕（非自動產生，Joe 已確認） |
| Cosmos Laundromat | [Y-rmzh0PI3c](https://www.youtube.com/watch?v=Y-rmzh0PI3c)（Blender）         | CC BY 3.0（[gooseberry.blender.org/license](https://gooseberry.blender.org/license/)）                                       | (CC) Blender Foundation \| gooseberry.blender.org                               | YouTube 官方上傳的英文字幕（非自動產生，Joe 已確認） |
| Sprite Fright     | [\_cMxraX_5RE](https://www.youtube.com/watch?v=_cMxraX_5RE)（Blender Studio） | 官方頁寫「Creative Commons Attribution 1.0」（[官方](https://studio.blender.org/films/sprite-fright/pages/about)），屬 CC BY | (CC) Blender Foundation \| studio.blender.org                                   | YouTube 官方上傳的英文字幕（非自動產生，Joe 已確認） |

M3 待辦：

- 從 YouTube 官方字幕取得對白文字與時間，挑連續約 10 句並記下段落（目前尚未截取，字幕內容無法用程式讀取，需在瀏覽器取得）。
- Sprite Fright 官方頁的「1.0」可能是筆誤（其他片都是 3.0），不論版本都屬 CC BY；JSON 依官方原文填寫。

## 候選：VOA Let's Learn English（Public Domain）

授權：VOA 官方頁面 [learningenglish.voanews.com/p/6861.html](https://learningenglish.voanews.com/p/6861.html)：「Learning English texts, MP3s, photos and videos are in the public domain. You are allowed to reprint them for educational and commercial purposes, with credit to learningenglish.voanews.com.」（通訊社素材如 AP、Reuters、AFP 除外；以下皆為 VOA 自製課程。）

- 出處註明：`learningenglish.voanews.com`
- 官方頻道：`UCKyTokYo0nK2OA-az-sDijA`「VOA Learning English」（VOA 官網連到 youtube.com/voalearningenglish）
- 同一集的證據：YouTube 描述「Originally published at」連到的 VOA 影片編號，與逐字稿頁上嵌入的對話影片編號相同。
- 逐字稿：2016 年舊版課程頁上的對話。2019 年改版後的課程頁沒有逐字稿，不要用。
- 句：一句台詞（同一人連續說的話）。時間為依字數估算（±10～20 秒），M3 時以時間點工具（`/videos/<id>/timing`）微調。

| 課                               | YouTube（影片編號）                                                   | 逐字稿頁                                                                                                     | 截取                            | 估計時間   | 主題                     |
| -------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------- | ---------- | ------------------------ |
| Lesson 7: What Are You Doing?    | [THMKsKMTyqg](https://www.youtube.com/watch?v=THMKsKMTyqg)（3345754） | [3240468](https://learningenglish.voanews.com/a/lets-learn-english-lesson-7-what-are-you-doing/3240468.html) | 對話第 1～11 句                 | 0:05～0:42 | 職場：第一天上班見老闆   |
| Lesson 8: Are You Busy?          | [uHuChnbaw6k](https://www.youtube.com/watch?v=uHuChnbaw6k)（3345760） | [3253185](https://learningenglish.voanews.com/a/lets-learn-english-lesson-8-are-you-busy/3253185.html)       | 對話第 2～13 句                 | 0:22～1:09 | 職場：向忙碌的同事道歉   |
| Lesson 10: Come Over to My Place | [34LhID6vT1k](https://www.youtube.com/watch?v=34LhID6vT1k)（3369337)  | [3285228](https://learningenglish.voanews.com/a/lets-learn-english-lesson-10/3285228.html)                   | 對話第 2～13 句                 | 0:15～1:11 | 生活：電話中指路到家     |
| Lesson 6: Where Is the Gym?      | [zkEnsSVBfPM](https://www.youtube.com/watch?v=zkEnsSVBfPM)（3345741） | [3225958](https://learningenglish.voanews.com/a/lets-learn-english-lesson-6-where-is-the-gym/3225958.html)   | 對話第 2～13 句（略過舞台指示） | 0:21～1:16 | 生活：在公寓大樓找健身房 |
| Lesson 12: Meet My Family        | [ncA2an5c1_g](https://www.youtube.com/watch?v=ncA2an5c1_g)（3345848） | [3301733](https://learningenglish.voanews.com/a/lets-learn-english-lesson-12-meet-my-family/3301733.html)    | 對話第 2～12 句                 | 0:15～0:54 | 生活：想家時看家人照片   |

備註：Lesson 12 官網逐字稿第 13 句有錯字「That-That';s」，不在截取段落內。

## 已排除（記錄原因，避免重複查）

- VOA「English in a Minute」（Sugarcoat 等）：官網沒有逐字稿；Actions Speak Louder Than Words 不在官方頻道。
- Blender「Wing It!」「Charge」：專案頁查不到授權文字，對白也很少。
- 2016 年 3～4 月早期上傳與 2022 年兒童版的 Let's Learn English：影片編號與逐字稿頁不符。
