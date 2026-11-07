# 打包成 Android App（Trusted Web Activity）

ListenLoop 是 PWA，Android 版用 **Trusted Web Activity（TWA）** 包裝：App 用 Chrome 全螢幕開啟正式網站，網站更新後 App 不用重新上架。

## 1. 先確認 PWA 條件（已完成，D64）

- `https://listenloop-three.vercel.app/manifest.webmanifest`：名稱、圖示（192、512、maskable）、主題色、`display: standalone`。
- Service worker：`/sw.js`，離線時顯示 `/offline`。
- 在 Chrome 開發人員工具 → Application → Manifest 沒有錯誤，網址列出現「安裝」。

## 2. 用 PWABuilder 打包（建議，不用安裝工具）

1. 打開 https://www.pwabuilder.com ，輸入 `https://listenloop-three.vercel.app`，按 Start。
2. 分數頁確認 Manifest、Service Worker 都通過後，按 **Package For Stores → Android → Generate Package**。
3. 選項：
   - Package ID：`app.listenloop.twa`（上架後不能改，請先確認）；
   - App name：`ListenLoop`；Launcher name：`ListenLoop`；
   - Signing key：選 **Create new**（第一次）。PWABuilder 會產生 `.keystore` 和密碼，**請備份在安全的地方**（例如密碼管理器），遺失就不能更新 App。
4. 下載 zip，裡面有：
   - `app-release-bundle.aab`：上傳到 Play Console；
   - `assetlinks.json`：數位資產連結；
   - `signing.keystore` 和 `signing-key-info.txt`。

## 3. 數位資產連結（Digital Asset Links）

TWA 要證明 App 和網站是同一個擁有者，否則會顯示網址列。

- 檔案位置：`public/.well-known/assetlinks.json`，部署後的網址是 `https://listenloop-three.vercel.app/.well-known/assetlinks.json`。
- 目前 repo 裡是範本（指紋是空的），要換成實際的值：
  1. **上傳金鑰的指紋**：PWABuilder zip 裡的 `assetlinks.json`。
  2. **Google Play 的應用程式簽署金鑰指紋**：上傳到 Play Console 後，在「測試與發布 → 設定 → 應用程式完整性 → 應用程式簽署」複製 SHA-256。Play 會用自己的金鑰重新簽署，所以兩個指紋都要放進 `sha256_cert_fingerprints`。
- 告訴 Claude 這兩個指紋（不是秘密，可以貼在對話中），Claude 會更新檔案並部署。
- 驗證：https://developers.google.com/digital-asset-links/tools/generator 輸入網域、Package ID、指紋，按 Test statement。

## 4. 另一個做法：Bubblewrap（命令列）

需要 Node.js 和 JDK，適合想在本機控制所有設定時使用：

```
npx @bubblewrap/cli init --manifest https://listenloop-three.vercel.app/manifest.webmanifest
npx @bubblewrap/cli build
```

產生的 `app-release-bundle.aab` 同樣上傳到 Play Console。

## 5. 上傳後

依 `docs/play-store.md` 的步驟，先建立封閉測試，再申請正式版。
