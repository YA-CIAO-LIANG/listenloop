# 影片製作流程（M3 內容庫）

每支影片從查證到上架的步驟。授權規則與候選清單見 `docs/video-candidates.md`；資料格式見 CLAUDE.md「資料格式」。

## 1. 查證（Claude）

- 在**官方頁面**確認授權（只用 CC BY、CC BY-SA、Public Domain），記下網址與官方要求的出處註明。
- 用頻道 ID 確認 YouTube 上傳者是權利人官方頻道，並用 oEmbed 確認可以嵌入。
- 確認逐字稿與影片是同一集（VOA：YouTube 描述裡「Originally published at」的影片編號 = 逐字稿頁嵌入的影片編號）。
- 結果寫進 `docs/video-candidates.md`。

## 2. 取得英文句子

- **有官方字幕檔（`.srt`）的影片**（例如 Sintel、Tears of Steel）：直接用字幕檔，文字和時間都照官方，不需要另外整理句子。
- **Blender 等只有 YouTube 字幕的影片**：字幕無法用程式讀取。請 Joe 在瀏覽器打開影片的「⋯ → 顯示字幕記錄」，把要用的段落文字複製給 Claude（要官方上傳的字幕，不要自動產生的）。
- 沒有字幕檔時存成文字檔，**一行一句**。挑連續約 10～12 句、不超過約 1 分鐘的段落。

## 3. 產生草稿（腳本）

準備 `meta.json`（id、youtubeId、title、level、category、source、attribution），再依句子來源加上：

- **`.srt` 字幕檔**：`"cues": { "from": 1, "to": 11, "skip": [9] }`，用字幕編號表示要用的範圍（含頭尾），`skip`（選填）是要略過的字幕，例如粗話或只有尖叫聲的句子。文字和時間照字幕檔；編號打錯時腳本會報錯，不會默默多抓或少抓。
- **文字檔**：`"from"`、`"to"`，段落的大約起訖秒數，依字數估算每句時間。

```sh
npm run video:new -- meta.json subtitles.srt   # 或 sentences.txt
```

- 產生 `data/videos/<id>.json`（`"draft": true`），中文先填「（待翻譯）」，並登記進 `data/videos/index.ts`。
- 字幕裡若有畫面文字（例如「"Fourty years later"」）或句首的「...」，寫內容時手動整理，並在 `changes` 註明。
- 草稿不會出現在影片庫，影片頁與練習頁回 404；只有 `/videos/<id>/timing` 打得開。

## 4. 撰寫內容（Claude）

- 每句的中文翻譯（自然的台灣用語，對應原句意思，不逐字硬翻）。
- 8～12 個單字：詞性、中文、一個新的簡單例句；每個標註出自第幾句（`sentence`）。
- 3～4 個文法點：重點、中文說明、一個新的例句；同樣標註 `sentence`。
- App 執行時不呼叫 AI；內容直接寫在 JSON。

## 5. 校正時間點（Joe，每支約 1～2 分鐘）

1. 打開預覽網站的 `/videos/<id>/timing`。
2. 「點按模式」：設定起點（預設第一句前 1 秒）→「開始點按」→ 每句開頭按空白鍵（手機按「這句開始了」）→ 最後一句說完按 Enter。按錯就「上一句重來」。
3. 用下方逐句「播放」檢查，必要時 ±0.1 秒微調。
4. 「複製 JSON」，貼給 Claude。

## 6. 上架

- Claude 把時間點貼回 JSON、拿掉 `draft`，跑五項檢查（測試會擋下仍有「（待翻譯）」的正式影片）。
- PR（分支 `content/…`）逐支列出句子、翻譯、單字、文法給 Joe 審稿；Joe 說「合併」才上架。
