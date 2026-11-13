# SEO 設定與搜尋引擎提交（D167）

這份文件給 Joe：網站已經做好的 SEO 項目、要在 Google 與 Bing 操作的步驟，以及之後換成自己網域時要注意的事。

## 網站已經做好的事

| 項目                   | 位置                                                          | 說明                                                                   |
| ---------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| sitemap                | `/sitemap.xml`（`app/sitemap.ts`）                            | 公開頁、主題頁、文章、內建影片、官方教材；每個網址附中英文版本         |
| robots                 | `/robots.txt`（`app/robots.ts`、`lib/site.ts`）               | 擋下後台、帳號、API、練習步驟等頁面，並指向 sitemap                    |
| 標題、描述、canonical  | `lib/seo.ts`、`i18n/metadata.ts`                              | 每個公開頁都有自己的標題與描述（測試確保不重複）                       |
| 中英文網址（hreflang） | 中文：一般網址；英文：網址加 `?hl=en`                         | 搜尋引擎可以分別收錄兩種語言，不影響使用者自己選的語言                 |
| 分享圖片               | 主題頁、教材頁各自產生（`opengraph-image.tsx`）               | 貼到 LINE、Facebook、X 時顯示標題圖片                                  |
| 結構化資料             | 首頁、教材頁、主題頁、文章、FAQ                               | WebApplication、LearningResource、BreadcrumbList、BlogPosting、FAQPage |
| 驗證 meta              | 環境變數 `GOOGLE_SITE_VERIFICATION`、`BING_SITE_VERIFICATION` | 設定後網站的 `<head>` 會出現驗證標籤                                   |

關鍵字與對應頁面見 `docs/seo-keywords.md`。

## 1. Google Search Console（免費，不需要信用卡）

1. 用你的 Google 帳號打開 https://search.google.com/search-console 。
2. 按左上角的資源選單 →「新增資源」。
3. 選右邊的 **「網址前置字元」**，輸入 `https://listenloop-three.vercel.app`（要包含 `https://`，結尾不要斜線），按「繼續」。
   - 左邊的「網域」需要改 DNS，`vercel.app` 不是你的網域，不能用；之後換成自己的網域再改用「網域」資源。
4. 驗證方式選 **「HTML 標記」**，會看到一行像這樣的程式碼：
   `<meta name="google-site-verification" content="AbCdEf123..." />`
   只複製 `content="..."` 引號裡的那串文字。**先不要按「驗證」。**
5. 到 Vercel → 專案 → Settings → Environment Variables：
   - Key：`GOOGLE_SITE_VERIFICATION`
   - Value：剛剛複製的那串文字
   - Environment：只勾 Production
   - 按 Save。
6. Vercel → Deployments → 最新一筆 → 右邊「⋯」→ **Redeploy**，等它變成 Ready（約 2～3 分鐘）。
7. 確認標籤出現了：用瀏覽器打開正式站，按右鍵「檢視網頁原始碼」，搜尋 `google-site-verification`，看得到就可以。
8. 回到 Search Console 按 **「驗證」**。成功後會看到「已驗證擁有權」。
9. 提交 sitemap：左側選單「Sitemap」→「新增 Sitemap」輸入 `sitemap.xml` → 提交。狀態顯示「成功」即可（第一次可能要等幾小時到幾天才讀取）。
10. 要求建立索引（選做，加快收錄）：上方搜尋列輸入首頁網址 → 「要求建立索引」。可以再對 `/faq`、`/learn`、`/blog` 各做一次（每天有次數限制）。
11. 幾天後檢查：
    - 「網頁」報表：有多少頁已建立索引、哪些沒有及原因（「已排除：noindex」是正常的，那些是個人頁）。
    - 「強化項目」：麵包屑、常見問題是否有錯誤。
    - 「成效」：開始有人從 Google 進站後，可以看到搜尋字詞與點閱率。

> 驗證成功後**不要刪掉** `GOOGLE_SITE_VERIFICATION`，Google 會定期重新檢查。

## 2. Bing Webmaster Tools（免費，也涵蓋 Yahoo 與 DuckDuckGo 的部分結果）

**最快的方法：從 Google Search Console 匯入**（做完上面第 1 節之後）

1. 打開 https://www.bing.com/webmasters ，用 Microsoft 或 Google 帳號登入。
2. 選 **「從 GSC 匯入」**（Import from Google Search Console），授權後勾選 `listenloop-three.vercel.app`，按匯入。網站與 sitemap 會一起匯入並自動驗證。
3. 完成。

**如果匯入不能用，改用 meta 標籤：**

1. 在 Bing Webmaster Tools 選「手動新增網站」，輸入 `https://listenloop-three.vercel.app`。
2. 驗證方式選 **「HTML Meta 標籤」**，會看到 `<meta name="msvalidate.01" content="1234ABCD..." />`，只複製 `content` 引號裡的文字。
3. Vercel → Environment Variables 新增 `BING_SITE_VERIFICATION` = 那串文字（Production）→ Save → Redeploy。
4. 回到 Bing 按「驗證」。
5. 左側「Sitemap」→「提交 Sitemap」→ 輸入 `https://listenloop-three.vercel.app/sitemap.xml`。

## 3. 檢查工具（任何時候都可以用）

- 結構化資料：https://search.google.com/test/rich-results ，貼上一個教材頁或 `/faq` 的網址，應該看到「麵包屑」「常見問題」等項目沒有錯誤。
- 分享圖片：把教材頁網址貼到 LINE 或 Facebook 的貼文框（不用送出），應該會出現有標題的圖片。

## 4. 換成自己的網域（例如 `listenloop.tw`）

### 對 SEO 的好處

- **品牌與信任**：`listenloop.tw` 比 `listenloop-three.vercel.app` 好記，使用者比較願意點、也比較會直接輸入網址回來。
- **累積在自己身上**：之後所有反向連結（別人連到你的網站）、搜尋排名都累積在你擁有的網域；`vercel.app` 子網域無法搬走，換主機時要重來。
- **可以用 Search Console 的「網域」資源**：一次涵蓋 `www`、無 `www`、`http`、`https` 和所有子網域。
- `.tw` 網域對台灣使用者有些許在地訊號（不是決定性因素）。

### 換網域時要注意（照順序做，我可以幫你準備程式的部分）

1. **買網域並加到 Vercel**：Vercel → 專案 → Settings → Domains → Add，照畫面在網域商設定 DNS（A 或 CNAME 紀錄）。把新網域設為主要網域。
2. **301 永久轉址**：Vercel 會讓舊的 `listenloop-three.vercel.app` 繼續可以開；在 Domains 設定裡把舊網址設成「Redirect to」新網域（選 **301 / Permanent**），每一頁都要轉到新網域的同一路徑（不是全部轉到首頁）。
3. **改 `NEXT_PUBLIC_SITE_URL`**：Vercel 環境變數改成 `https://listenloop.tw`，Redeploy。canonical、hreflang、sitemap、分享圖片的網址都會一起換成新網域。
4. **Supabase 登入網址**：Supabase → Authentication → URL Configuration：
   - Site URL 改成新網域；
   - Redirect URLs 加入 `https://listenloop.tw/**`（舊的先保留，轉換期過了再刪）。
5. **Google 登入（OAuth）**：Google Cloud Console → API 和服務 → 憑證 → OAuth 用戶端：
   - 「已授權的 JavaScript 來源」加入新網域；
   - 「OAuth 同意畫面」的應用程式首頁、隱私權政策、服務條款連結改成新網域；授權網域加入 `listenloop.tw`。
   - Supabase 的 callback 網址（`https://<專案>.supabase.co/auth/v1/callback`）不用改。
6. **LINE 登入**（有開的話）：LINE Developers → Channel → Callback URL 加入新網域對應的網址。
7. **其他外部服務**：Clarity 的網站網址、UptimeRobot 監控網址、Cloudflare Turnstile 的允許網域、付款服務的回呼網址（若已啟用）、Google Play／PWA 的 manifest 網址（若已上架）。
8. **Search Console 的「網址變更」工具**：在新網域建立並驗證資源（建議用「網域」資源＋DNS TXT 驗證）→ 在**舊**資源的「設定」→「網址變更」→ 選新網域 → 送出。Google 會依此把排名轉到新網域。新網域也要再提交一次 sitemap。
9. **Bing**：在 Bing Webmaster Tools 新增新網域並提交 sitemap；Bing 也有「Site Move」工具可以通知搬家。
10. **轉換期**：舊網址的 301 轉址至少保留一年；排名通常在幾週內轉移，期間流量小幅波動是正常的。

## 常見問題

- **為什麼英文版網址有 `?hl=en`？** 網站的語言存在 cookie，搜尋引擎不帶 cookie，所以英文版需要自己的網址。`?hl=en` 只影響那一次開啟，不會改掉使用者自己選的語言（D167）。
- **為什麼有些頁面搜不到？** 帳號、我的教材、學習進度、後台、別人分享的練習、練習的第幾天等頁面刻意不讓搜尋引擎收錄（隱私與重複內容）。
- **文章為什麼只有中文？** 目標使用者是台灣學生；英文介面的使用者看到的文章仍是中文，所以文章只登記中文版本。
