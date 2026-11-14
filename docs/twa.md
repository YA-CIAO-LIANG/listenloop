# 打包成 Android App 並上架 Google Play（Trusted Web Activity，D178）

> 2026-11-14 改寫：從 PWABuilder 改成用 **Bubblewrap** 依 repo 裡的 `android/twa-manifest.json` 打包。設定都在 repo 裡，每次打包結果一樣；簽署金鑰由 Joe 自己產生、自己保管，**永遠不進 repo**。
> 正式填寫 Play Console 前，請以 Play Console 當下的畫面與規定為準。

ListenLoop 是 PWA，Android 版用 **Trusted Web Activity（TWA）** 包裝：App 用手機上的 Chrome 全螢幕開啟正式網站（沒有網址列）。網站更新後 App 不用重新上架；只有圖示、顏色、Package ID、版本這類 App 本身的設定改了才要重新打包。

## 0. 已經準備好的部分（程式這邊）

| 項目               | 位置                                                              | 說明                                                                                                                                       |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| App 設定           | `android/twa-manifest.json`                                       | Package ID、名稱、圖示網址、啟動畫面與狀態列顏色、通知、`fallbackType: customtabs`。簽署金鑰路徑指向 repo 外面。                           |
| 圖示               | `public/icons/`                                                   | 512 px 一般、maskable（可裁切）、**monochrome**（Android 13 主題圖示，新增）；`node scripts/brand-assets.mts` 從 `brand/icon.svg` 重新產生 |
| 數位資產連結       | `https://listenloop-three.vercel.app/.well-known/assetlinks.json` | 由環境變數產生（`app/.well-known/assetlinks.json/route.ts`），沒設定時回 `[]`                                                              |
| 範本               | `android/assetlinks.template.json`                                | 產生出來的內容長這樣，只是參考                                                                                                             |
| App 內的體驗       | 見第 8 節                                                         | 返回鍵、選單、外部連結、登入都檢查過；E2E `e2e/twa.spec.ts` 用 Pixel 7 模擬 App 開啟                                                       |
| 不會進 repo 的東西 | `.gitignore`                                                      | `*.keystore`、`*.jks`、`*.aab`、`*.apk`、`android/` 裡 Bubblewrap 產生的專案                                                               |

**Package ID：`app.listenloop.twa`**。這是 App 在 Google Play 的永久識別碼，**上架後不能改**（改了就是另一個 App，評分與下載數都歸零）。沿用 2026-11-07 文件裡的寫法，因為簡短、和品牌一致；它只是識別碼，不需要真的擁有 listenloop.app 網域。要換的話，**第一次上傳到 Play Console 之前**改 `android/twa-manifest.json` 的 `packageId` 和 `android/assetlinks.template.json`，並告訴 Claude。

## 1. 安裝工具（第一次，約 20 分鐘）

1. 確認有 Node.js（開發 ListenLoop 已經裝了）：終端機輸入 `node -v`，要 18 以上。
2. 安裝 Bubblewrap：
   ```
   npm i -g @bubblewrap/cli
   ```
3. 執行檢查：
   ```
   bubblewrap doctor
   ```
   第一次會問要不要讓 Bubblewrap 自己下載 **JDK 17** 和 **Android SDK**：都回答 **Yes**（放在 `~/.bubblewrap/`，不會影響電腦上其他程式），並同意 Android SDK 的授權條款。最後看到 `Your jdkpath and androidSdkPath are valid.` 就完成了。
   - 如果你已經自己裝過 JDK 17 或 Android Studio，也可以用 `bubblewrap updateConfig --jdkPath=… --androidSdkPath=…` 指定。

## 2. 建立上傳金鑰（只做一次，最重要）

Google Play 用「上傳金鑰」確認更新真的是你上傳的。**金鑰和密碼都只存在你這邊，不要放進 repo、不要貼進對話。**

1. 在 repo **外面**開一個資料夾（`android/twa-manifest.json` 預設指向這裡）：
   ```
   mkdir -p ~/Projects/listenloop-signing
   ```
2. 找到 Bubblewrap 下載的 `keytool`（在 JDK 裡）：
   ```
   find ~/.bubblewrap -name keytool -type f
   ```
   以下用 `KEYTOOL` 代表找到的完整路徑（也可以先執行 `KEYTOOL="貼上路徑"`）。
3. 產生金鑰（有效 10000 天，約 27 年）：
   ```
   "$KEYTOOL" -genkeypair -v -keystore ~/Projects/listenloop-signing/listenloop-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
   會問密碼（輸入兩次）和姓名、組織、城市、國家（`TW`），這些資訊不會公開顯示。
4. **立刻備份**：
   - 密碼管理器（例如 1Password、Bitwarden）：存一筆「ListenLoop 上傳金鑰」，內容是 keystore 密碼、key 密碼（通常和 keystore 相同）、alias `upload`，並把 `listenloop-upload.jks` 檔案附加上去。
   - 離線備份：再複製一份到加密的 USB 隨身碟或外接硬碟，放在家裡。
   - 不要只放在雲端硬碟的公開或共用資料夾。
5. 為什麼兩份都要：第一次上架時選 **Play 應用程式簽署（Play App Signing，建議，也是新 App 的預設）**，真正發給使用者的簽署金鑰由 Google 保管；你的上傳金鑰遺失時可以向 Google 申請重設，但需要幾天、而且很麻煩，所以還是要備份好。

## 3. 打包（產生 .aab）

```
cd ~/Projects/listenloop/android
bubblewrap update --skipVersionUpgrade
bubblewrap build
```

- `update` 依 `twa-manifest.json` 產生 Android 專案（`app/`、`gradle/` 等，都已列在 `.gitignore`），並從正式網站下載圖示。
  - 如果 `update` 失敗，改用：`bubblewrap init --manifest=https://listenloop-three.vercel.app/manifest.webmanifest`，每個問題照 `twa-manifest.json` 的值回答（Package ID `app.listenloop.twa`、App name 和 Launcher name 都是 `ListenLoop`、金鑰選「已有的」並指到 `~/Projects/listenloop-signing/listenloop-upload.jks`、alias `upload`）。
- `build` 會問兩次密碼（keystore 和 key），完成後在 `android/` 產生：
  - `app-release-bundle.aab`：上傳到 Play Console 的檔案；
  - `app-release-signed.apk`：可以直接裝在自己手機上測試。
- 之後要出新版（例如換圖示、改顏色）：`bubblewrap update`（不加 `--skipVersionUpgrade`，會自動把 `appVersionCode` 加 1），再 `bubblewrap build`，把 `twa-manifest.json` 的變更提交進 repo。網站內容的更新**不用**重新打包。

## 4. 取得兩個 SHA-256 指紋，設定到 Vercel

TWA 要網站證明「這個 App 是我的」（Digital Asset Links），否則 App 上方會出現網址列。指紋**不是秘密**，可以貼在對話中。

1. **上傳金鑰的指紋**：
   ```
   "$KEYTOOL" -list -v -keystore ~/Projects/listenloop-signing/listenloop-upload.jks -alias upload
   ```
   複製 `SHA256:` 後面那一串（像 `14:6D:E9:…:44:E5`，共 32 組）。
2. **Play 應用程式簽署金鑰的指紋**（第一次上傳 .aab 到 Play Console 之後才有）：Play Console → 你的 App → **測試與發布 → 設定 → 應用程式完整性 → 應用程式簽署**，複製「應用程式簽署金鑰憑證」的 **SHA-256 憑證指紋**。（同一頁也列出上傳金鑰的指紋，可以對照第 1 步。）
3. Vercel → listenloop 專案 → **Settings → Environment Variables**，新增兩個變數（環境選 **Production**；Preview 不用）：

   | 名稱                      | 值                                                           |
   | ------------------------- | ------------------------------------------------------------ |
   | `TWA_PACKAGE_NAME`        | `app.listenloop.twa`                                         |
   | `TWA_SHA256_FINGERPRINTS` | `上傳金鑰指紋,Play 簽署金鑰指紋`（逗號分隔，不用空格也可以） |

   只有上傳金鑰的指紋時，先填一個也可以（自己手機裝 `app-release-signed.apk` 測試用）；拿到 Play 的指紋後再補上。

4. **Deployments → 最新的部署 → Redeploy**（環境變數要重新部署才生效）。
5. 打開 `https://listenloop-three.vercel.app/.well-known/assetlinks.json`，確認看到 `app.listenloop.twa` 和兩個指紋。格式不對的指紋會被略過（程式會自動轉大寫、補冒號）。

## 5. 驗證

1. Google 的工具：https://developers.google.com/digital-asset-links/tools/generator
   - Hosting site domain：`https://listenloop-three.vercel.app`
   - App package name：`app.listenloop.twa`
   - App package fingerprint：貼其中一個指紋 → 按 **Test statement**，要顯示成功；兩個指紋都測一次。
2. 也可以直接查 Google 的 API（結果要列出你的 App）：
   `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://listenloop-three.vercel.app&relation=delegate_permission/common.handle_all_urls`
3. 手機實測：
   - 用 USB 連接 Android 手機（開啟開發人員選項的 USB 偵錯），在 `android/` 執行 `bubblewrap install`，或把 `app-release-signed.apk` 傳到手機安裝。
   - 打開 App：**最上方沒有網址列**才是驗證成功。有網址列時：確認 Vercel 已重新部署、指紋正確，然後到手機的「設定 → 應用程式 → Chrome → 儲存空間」清除快取，或解除安裝再裝一次（Android 會快取驗證結果）。
   - 從 Play 安裝的版本用的是 Play 的簽署金鑰，所以 Play 的指紋一定要加進去。

## 6. Google Play Console

詳細的商店文字、分級問卷、資料安全的建議答案在 `docs/play-store.md`；商店資料最新版在 `marketing/word/09-Google-Play商店資料.docx`。

1. **註冊開發者帳號**：https://play.google.com/console ，一次性 **US$25**（需要信用卡，依工作規則由 Joe 決定）。個人帳號要上傳身分證件驗證，並用一支 Android 手機驗證。
2. **建立應用程式**：名稱 `ListenLoop`、預設語言「中文（台灣）– zh-TW」、類型「應用程式」、「免費」。
3. **App 內容**（政策 → App 內容，每一項都要完成）：
   - 隱私權政策：`https://listenloop-three.vercel.app/privacy`
   - 廣告：沒有廣告。
   - 應用程式存取權：主要功能不用登入；登入功能用 Google 帳號即可，審查人員可以用自己的帳號，通常選「所有功能都不需特殊存取權」，或附上說明。
   - 內容分級（IARC 問卷）：類別選「參考、新聞或教育」，依 `docs/play-store.md` 第 2 節回答；有使用者分享的公開教材，可能會顯示「使用者互動」。
   - 目標對象與內容：建議勾 **13–15、16–17、18 歲以上**，**不要勾 13 歲以下**（勾了要遵守「家庭」政策，限制很多；服務條款也寫未滿 13 歲請勿自行建立帳號，D60）。因為包含未成年人，Play 會檢查 App 不會不當吸引兒童，照實回答即可。
   - 資料安全：依 `docs/play-store.md` 第 3 節。
   - 政府應用程式、金融功能、健康：都選「否」。新聞應用程式：否。
4. **商店資訊**：
   - App 名稱、簡短說明、完整說明：`marketing/word/09-Google-Play商店資料.docx`；
   - 圖示 `docs/store/play-icon-512.png`（512×512）、主題圖片 `docs/store/feature-graphic.png`（1024×500）；
   - 手機截圖至少 2 張（建議 4～8 張），清單與拍法見 `docs/play-store.md` 第 4 節；
   - 類別：教育；聯絡 email：要提供一個公開的信箱。
5. **封閉測試（新個人帳號必須）**：2023-11-13 之後建立的個人開發者帳號，申請正式版之前，要有**至少 12 位測試者、連續 14 天**保持加入封閉測試。
   - 測試與發布 → 測試 → 封閉測試 → 建立測試群組（用 email 清單或 Google 群組），上傳 `app-release-bundle.aab` 建立版本並送審。
   - 把「加入測試」連結傳給測試者；他們要用 Google 帳號接受邀請，並從 Play 商店安裝。
   - 建議找 15～20 位（Beta 招募文案見 `marketing/word/08-Beta招募文案.docx`），避免有人中途退出讓天數重新計算；14 天內請大家實際打開使用並回饋。
   - 第一次上傳後，記得回到第 4 節把 **Play 簽署金鑰的指紋**加進 Vercel。
6. **申請正式版存取權**：14 天滿後，在資訊主頁按「申請正式版存取權」，回答測試心得問卷（測試者人數、收到哪些回饋、改了什麼），等待審核（通常幾天）。
7. **發布正式版**：建立正式版、上傳同一份或更新的 .aab、送審。

參考：Google Play「新個人開發者帳號的測試規定」https://support.google.com/googleplay/android-developer/answer/14151465

## 7. 之後要注意的事

- **付費方案**：目前「訂閱」是假門加等候名單，沒有收錢，不違反 Play 政策。開放收費時，**在 App 裡販售數位訂閱必須用 Google Play 帳款服務**：要在 `twa-manifest.json` 開啟 `features.playBilling`，網站用 Digital Goods API；或在 App 裡（`<html data-twa>`，見第 8 節）不顯示網頁的付款流程。這件事要在開放收費前決定。
- **換成自訂網域**：`host`、圖示網址要改，重新打包出新版；新網域也要提供 `assetlinks.json`（同一份程式，在新網域的 Vercel 設定同樣的環境變數）。Package ID 不變。
- **金鑰**：每次 `bubblewrap build` 都用同一把上傳金鑰；換電腦時從密碼管理器或離線備份還原到 `~/Projects/listenloop-signing/`。

## 8. App 內的體驗（已檢查，D178）

- **返回鍵**：TWA 就是 Chrome，Android 的返回鍵（或手勢）等於瀏覽器的「上一頁」；練習的每一天都是獨立網址，所以會依序回到影片頁、首頁，最前面再按一次才離開 App。對話框（原生 `<dialog>`）會先關閉；帳號選單、聲音選單也改成按返回鍵先關閉（`components/useCloseOnBack.ts`，用 Chrome 的 CloseWatcher）。
- **登入**：Google 不允許在 WebView 裡登入，但 TWA 是真正的 Chrome，所以可以；登入時會短暫顯示 Google 的網址列，回到 `https://listenloop-three.vercel.app/auth/callback` 後網址列消失，登入狀態和手機 Chrome 共用。LINE 登入同樣在 Chrome 裡完成；手機有裝 LINE 時可能會跳到 LINE App 確認，**上架前請用實機測一次 LINE 登入能回到 App**。
- **外部網站**（授權條款、原始影片、部落格的外部連結）：用新分頁開啟，在 App 裡會是 Custom Tab（上方有網址與關閉鈕），關掉就回到 App。
- **偵測是不是在 App 裡**：Android 開啟 App 的第一頁時，`document.referrer` 是 `android-app://app.listenloop.twa/`；`components/TwaMarker.tsx` 記在這個分頁的 sessionStorage，並在 `<html>` 加上 `data-twa`。目前畫面沒有差異（網站沒有「安裝 App」的提示），之後付費功能等需要區分時用它。
- **通知**：`enableNotifications: true`，練習提醒（網頁推播）會變成 Android 通知；Android 13 以上第一次會詢問通知權限。
