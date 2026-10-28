# 影片候選清單

M3 擴充影片庫時從這裡接著做。每支都已確認：授權在官方頁面查到、YouTube 上傳者是權利人官方頻道（以頻道 ID 比對）、可以嵌入（oEmbed）、有官方英文逐字稿或字幕。Joe 已在瀏覽器確認（2026-10-26）：截取段落畫面上沒有燒入整句台詞、配樂不會蓋過對白。

## M3 進度

製作流程見 `docs/content-workflow.md`。只用 Blender 開放電影，一部切成多段（每段約 10～12 句，各算一支影片），目標是 Blender 片能做到的最多支數，預估 12～13 支（2026-10-28 決定；VOA 已排除，見下方）。

| PR   | 內容                                                                  | 狀態  |
| ---- | --------------------------------------------------------------------- | ----- |
| M3-1 | 工具：草稿機制、時間點工具點按模式、`npm run video:new`、製作流程文件 | 完成  |
| M3-2 | `npm run video:new` 直接讀官方 `.srt` 字幕（文字與時間照字幕）        | 本 PR |
| M3-3 | Tears of Steel 3 段                                                   | 待做  |
| M3-4 | Elephants Dream、Cosmos Laundromat、Sprite Fright 共約 8 段           | 待做  |
| M3-5 | 影片庫依程度、類別篩選（視影片數量，也可能縮小成簡單分組）            | 待做  |

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

## 已排除（記錄原因，避免重複查）

- VOA Let's Learn English（Public Domain，2026-10-28 排除）：Lesson 6、7、8、10、12 做成草稿試用（PR #28，已關閉），Joe 確認字和聲音對不上，改用 Blender 開放電影。官方逐字稿是 2016 年舊版課程頁，可能和 YouTube 上的影片版本不同。
- VOA「English in a Minute」（Sugarcoat 等）：官網沒有逐字稿；Actions Speak Louder Than Words 不在官方頻道。
- Blender「Wing It!」「Charge」：專案頁查不到授權文字，對白也很少。
- 2016 年 3～4 月早期上傳與 2022 年兒童版的 Let's Learn English：影片編號與逐字稿頁不符。
