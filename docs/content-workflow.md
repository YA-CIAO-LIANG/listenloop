# 影片製作流程（M3 內容庫）

每支影片從查證到上架的步驟。授權規則與候選清單見 `docs/video-candidates.md`；資料格式見 CLAUDE.md「資料格式」。

## 1. 查證（Claude）

- 在**官方頁面**確認授權（只用 CC BY、CC BY-SA、Public Domain），記下網址與官方要求的出處註明。
- 用頻道 ID 確認 YouTube 上傳者是權利人官方頻道，並用 oEmbed 確認可以嵌入。
- 確認句子來源和播放的影片是同一個版本：官方 `.srt` 要和 YouTube 片長相同；沒有 `.srt` 時用那支 YouTube 影片本身的字幕（上傳者提供，不可用自動產生的）。不用網站上的逐字稿頁，它可能是不同版本（2026-10-28 VOA 的教訓）。
- 結果寫進 `docs/video-candidates.md`。

## 2. 取得英文句子

- **有官方字幕檔（`.srt`）的影片**（例如 Sintel、Tears of Steel）：直接用字幕檔，文字和時間都照官方，不需要另外整理句子。
- **只有 YouTube 字幕的影片**（VOA、Elephants Dream 等）：字幕無法用程式讀取。請 Joe 在瀏覽器打開影片的「⋯ → 顯示字幕記錄」，確認語言是「English」（不是「English (auto-generated)」），把**含時間**的文字整段複製給 Claude（「0:05」換行「Come in.」這種格式即可；畫面上若有「5 秒」這類讀秒文字一起複製也沒關係，腳本會略過）。Claude 存成 `transcript.txt`。
- 都沒有時才存成文字檔，**一行一句**，時間依字數估算（不建議，可能對不上）。
- 段落依 `docs/video-candidates.md` 的段落規劃（依長度區間）切；每段至少 1 分鐘（第一句開始到最後一句結束）。

## 3. 產生草稿（腳本）

準備 `meta.json`（id、youtubeId、title、level、category、collection、source、attribution；collection 目前是 `blender-open-movies`），再依句子來源加上：

- **字幕（`.srt` 或 YouTube 字幕記錄）**：`"cues": { "from": 1, "to": 11, "skip": [9], "merge": [[3, 4]] }`。
  - `from`／`to`：用字幕編號表示要用的範圍（含頭尾）。YouTube 字幕記錄從 1 開始依序編號，和 `.srt` 一樣。
  - `skip`（選填）：要略過的字幕，例如粗話或只有尖叫聲的句子。
  - `merge`（選填）：同一句話被字幕切成好幾行時，把 `[第一行, 最後一行]` 合成一句（開始時間取第一行，結束時間取最後一行）。
  - **合併規則：中間停頓超過 2 秒就拆成兩句**（前一行結束到下一行開始，`lib/draft-video.ts` 的 `MAX_MERGE_GAP`）。合併後整句一起播放，停頓太長會變成一段空白，聽寫時也分不清句子在哪裡結束。超過時腳本會報錯；剛好 2 秒仍可合併。例如 Tears of Steel 的「I'm-」和「I'm sorry.」停了 10 秒，所以拆成兩句。
  - 文字和時間照字幕；編號打錯時腳本會報錯，不會默默多抓或少抓。
  - YouTube 字幕記錄只有開始時間：每句的結束時間 = 下一句開始前 0.1 秒（和點按模式相同），最後一句依字數估算，再用點按模式校正。
- **文字檔**：`"from"`、`"to"`，段落的大約起訖秒數，依字數估算每句時間。

```sh
npm run video:new -- meta.json subtitles.srt     # 官方字幕檔
npm run video:new -- meta.json transcript.txt    # YouTube 字幕記錄（開頭是時間就自動辨識；也可加 --transcript）
npm run video:new -- meta.json sentences.txt     # 一行一句
```

- 產生 `data/videos/<id>.json`（`"draft": true`），中文先填「（待翻譯）」，並登記進 `data/videos/index.ts`。
- 字幕裡若有畫面文字（例如「"Fourty years later"」）或句首的「...」，寫內容時手動整理，並在 `changes` 註明。
- 草稿不會出現在影片庫，影片頁與練習頁回 404；只有 `/videos/<id>/timing` 打得開。

### 一部片切成多段：完整版是唯一的時間來源

- 先做涵蓋全部段落的完整版（例如 `tears-of-steel-full`），時間點只在完整版校正。
- 各段用同一份字幕、同樣的 `skip`／`merge` 產生，再加上 `"excerptOf": { "video": "tears-of-steel-full", "from": 11 }`：`from` 是這段第一句在完整版的索引（從 0 開始）。
- 各段的句子（英文、中文、開始、結束）必須和完整版那一段完全相同：`npm run video:sync` 從完整版複製過去；build 與測試（`excerptProblems`）會擋下不一致的資料。單字與文法每段自己寫。
- 各段的 `/timing` 頁不提供校正，只顯示說明和連到完整版時間點頁的連結。

## 4. 撰寫內容（Claude）

- 每句的中文翻譯（自然的台灣用語，對應原句意思，不逐字硬翻）。
- 8～12 個單字：詞性、中文、一個新的簡單例句；每個標註出自第幾句（`sentence`）。
- 3～4 個文法點：重點、中文說明、一個新的例句；同樣標註 `sentence`。
- App 執行時不呼叫 AI；內容直接寫在 JSON。

## 5. 校正時間點（Joe，每支約 1～2 分鐘）

1. 打開預覽網站的 `/videos/<id>/timing`（切成多段的影片只校正完整版）。
2. 「點按模式」：設定起點（預設第一句前 1 秒）→「開始點按」→ 每句開頭按空白鍵（手機按「這句開始了」）→ 最後一句說完按 Enter。按錯就「上一句重來」。
3. 用下方逐句「播放」檢查，必要時 ±0.1 秒微調。
4. 「複製 JSON」，貼給 Claude。

## 6. 上架

- Claude 把時間點貼回 JSON（切成多段的影片貼回完整版，再執行 `npm run video:sync` 帶入各段）、拿掉 `draft`，跑五項檢查（測試會擋下仍有「（待翻譯）」的正式影片）。
- PR（分支 `content/…`）逐支列出句子、翻譯、單字、文法給 Joe 審稿；Joe 說「合併」才上架。
