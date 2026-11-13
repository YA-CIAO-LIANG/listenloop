# 事故應變手冊（D157）

出事時照這份做。原則：**先止血、再通知、再修復、最後檢討**。不確定時，先開「唯讀模式」，不會比較糟。

- 緊急開關：後台 `/admin/ops`（維護模式、唯讀模式、6 個個別功能；約 30 秒生效，管理員不受影響）。
- 公告：同一頁下方「網站公告」，會出現在每一頁和 `/status`。
- 通知：Discord（有設定時）與 `/admin/ops` 的「通知紀錄」（D156）。
- 回滾部署：`docs/deploy-rollback.md`。
- 備份與還原：`docs/backup.md`。
- 事後檢討：複製 `docs/postmortem-template.md`。

## 0. 嚴重程度與時間目標

| 等級 | 例子                                    | 目標：開始處理 | 目標：止血 |
| ---- | --------------------------------------- | -------------- | ---------- |
| SEV1 | 網站全掛、資料外洩、金鑰外洩、被入侵    | 15 分鐘內      | 1 小時內   |
| SEV2 | 建立教材全壞、AI 額度灌爆、違法內容公開 | 1 小時內       | 4 小時內   |
| SEV3 | 單一功能異常、少數人受影響              | 當天           | 3 天內     |

SEV1、SEV2 結束後一週內寫事後檢討。

## 通用流程

1. **確認**：打開 `/status`、`/api/health`、`/admin/ops` 的通知紀錄、`/admin/errors`、Vercel 與 Supabase 後台。
2. **止血**：用下面情境對應的開關。
3. **通知使用者**：發布公告。範本：
   - 中：「目前 ○○ 暫時無法使用，我們正在處理，練習進度不受影響。預計 ○○ 前恢復，最新狀況請看服務狀態頁。」
   - 英：“○○ is unavailable for now and we're working on it; your progress is safe. We expect it back by ○○. See the status page for updates.”
4. **修復**，確認恢復後關掉開關、結束公告（或改成「已恢復」的公告，顯示 24 小時）。
5. **記錄**：時間軸（何時發現、何時止血、何時恢復）寫進事後檢討。

---

## 1. Azure 服務中斷，或額度用完

**如何發現**

- 通知：「健康檢查失敗：ai」或「speech」、「全站本月 AI 額度已用 80%／已用完」、「本月 Azure 語音免費字數已用 80%」。
- `/admin/usage` 的連線測試失敗；使用者回報「建立教材失敗」。
- Azure 狀態頁：<https://azure.status.microsoft/>。

**立即要做的事**

1. 用 `/admin/usage` 的「連線測試」分辨問題：是 Azure 本身掛了（狀態頁有事故），還是我們的金鑰或額度出了問題。
2. Azure 掛了：開關暫停「AI 生成文字」「用指令修改」「語音轉文字」。持續 1 小時以上時，直接開「唯讀模式」，避免使用者做到一半失敗。
3. 全站每月上限用完（US$8）：程式已經自動暫停一般使用者（D77），不需要再開開關。決定要不要調高上限（`/admin/usage` 的設定），**先確認不是被濫用**（看 `/admin/users` 的本月花費排行）。
4. F0 語音字數用完：本月不能再產生音檔，下個月 1 日自動恢復。發公告說明。

**通知使用者**：公告「建立教材暫時無法使用，既有教材可以照常練習」。

**如何恢復**：Azure 恢復後先按連線測試，通過再關開關、結束公告。

**事後檢討**：花費是否異常（每週摘要）？上限要不要調整？

## 2. Azure 學生點數快用完（US$100，2027-11-04 到期）

**如何發現**：`/admin/usage` 的「Azure 學生額度剩餘」與「預測」；每週摘要的「照最近的速度約 ○○ 用完」。

**立即要做的事**

1. 剩 US$20 時：確認每月上限（`/admin/usage`）不會在到期前讓額度用完，必要時調低。
2. 剩 US$10 時：決定續用方式。可以換一般的隨用隨付訂閱（要信用卡，Joe 同意後才做），或是暫停 AI 建立。
3. 用完或到期：Azure 會停用資源。開「唯讀模式」或暫停 AI 功能，並發公告。

**如何恢復**：建立新的訂閱與資源，到 Vercel 更新 `AZURE_OPENAI_ENDPOINT`、`AZURE_OPENAI_API_KEY`、`AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION`，然後重新部署，再用連線測試確認。

## 3. Supabase 暫停，或流量、儲存超過上限

**如何發現**

- 通知：「健康檢查失敗：db」、「Supabase 資料庫／檔案儲存接近免費上限」。
- 網站全部 500、登入失敗；Supabase 寄來的 email。
- Supabase 狀態頁：<https://status.supabase.com/>。

**立即要做的事**

1. **專案被暫停**（7 天沒活動）：到 Supabase 後台按「Restore project」，約幾分鐘恢復。監控排程每 15 分鐘會讀一次資料庫，正常情況下不會發生；如果發生了，代表排程停了（見第 10 節）。
2. **資料庫接近 500 MB**：
   - 先在後台總覽看是哪張表變大（Supabase → Database → Tables，看大小）；
   - `events`、`error_logs` 會自動依保留期限清除（D55，每天執行）；
   - 如果是被灌資料（濫用），照第 6 節處理。
3. **Storage 接近 1 GB**：
   - 暫停「上傳音檔」；
   - 執行孤兒檔案清除（D161）；
   - 評估把音檔搬到 Cloudflare R2（`docs/capacity.md` 第 5 節），或升級 Supabase Pro（每月 US$25，要 Joe 同意）。
4. **egress 超過**：會變慢或被限制。先開唯讀模式，降低寫入與建立。

**通知使用者**：公告「網站暫時無法使用／部分功能暫停」。

**如何恢復**：恢復專案後先看 `/api/health`，再跑 `npm run rls:check` 確認權限正常。

## 4. Vercel 中斷，或部署壞掉

**如何發現**：Actions 通知「ListenLoop 無法連線」；Vercel 寄來的部署失敗 email；Vercel 狀態頁 <https://www.vercel-status.com/>。

**立即要做的事**

1. **新部署造成錯誤**（最常見）：照 `docs/deploy-rollback.md` 回到上一個正常的部署（Instant Rollback，約 1 分鐘）。不要急著修，先回滾。
2. **Vercel 本身中斷**：只能等。到 Vercel 狀態頁訂閱更新；網站打不開時也無法發公告，改用社群或 email 通知。
3. **Hobby 額度用完被暫停**：見 `docs/capacity.md` 第 3 節，升級 Pro（每月 US$20，要 Joe 同意），或等下個月。

**如何恢復**：在新分支修正，PR、CI 通過後合併，Vercel 會自動部署。部署完成後看 `/api/health` 和 `/status`。

## 5. 金鑰外洩

**如何發現**：GitHub secret scanning 的 email、gitleaks（CI）擋下、Azure 或 Google 的異常花費、別人告訴你。

**原則**：**先撤銷，再換新，最後查有沒有被用過。** 換新後要更新所有用到的地方（Vercel 的 Production 與 Preview、GitHub Actions secrets、`.env.local`），然後重新部署。

| 金鑰                                           | 在哪裡換新                                                                                                        | 換完要更新                                                      | 查有沒有被用過                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`（secret key）      | Supabase → Project Settings → API Keys → Secret keys：建立新的 secret key，部署後刪除舊的                         | Vercel、GitHub secrets（reminders、news、backup）、`.env.local` | Supabase → Logs → API，看陌生 IP 的大量請求 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`（publishable） | 本來就是公開的，安全靠 RLS；只有在 RLS 出問題時才需要換：同一頁建立新的 publishable key                           | Vercel（要重新 build）                                          | `npm run rls:check`                         |
| 資料庫密碼                                     | Supabase → Project Settings → Database → Reset database password                                                  | GitHub secret `SUPABASE_DB_URL`、密碼管理器                     | Supabase → Logs → Postgres                  |
| `AZURE_OPENAI_API_KEY`                         | Azure 入口網站 → Azure OpenAI 資源 → Keys and Endpoint → **Regenerate Key 1**（先改用 Key 2，部署後再重產 Key 1） | Vercel、`.env.local`                                            | Azure → Cost Management、資源的 Metrics     |
| `AZURE_SPEECH_KEY`                             | Azure 入口網站 → Speech 資源 → Keys and Endpoint → Regenerate                                                     | Vercel、`.env.local`                                            | 同上                                        |
| `GEMINI_API_KEY`                               | Google AI Studio → API keys → 刪除舊的、建立新的                                                                  | Vercel、`.env.local`                                            | Google Cloud → Billing                      |
| `GOOGLE_CLOUD_API_KEY`、`YOUTUBE_API_KEY`      | Google Cloud Console → APIs & Services → Credentials → 該金鑰 → Regenerate（並確認有限制 API 與來源）             | Vercel、`.env.local`                                            | Google Cloud → APIs → Metrics               |
| Google 登入的 OAuth client secret              | Google Cloud Console → Credentials → OAuth client → Reset secret                                                  | Supabase → Authentication → Providers → Google                  | Google Cloud → OAuth 的使用紀錄             |
| `LINE_CHANNEL_SECRET`                          | LINE Developers → Channel → Basic settings → Channel secret → Issue                                               | Vercel                                                          | —                                           |
| `PAYMENTS_WEBHOOK_SECRET`                      | 金流商後台的 webhook 設定 → 重新產生                                                                              | Vercel                                                          | `/admin/revenue` 有沒有不明的付款事件       |
| `VAPID_PRIVATE_KEY`                            | 本機 `npx web-push generate-vapid-keys` 產生一組新的（公鑰也要換，使用者要重新開啟提醒）                          | Vercel、GitHub secrets                                          | —                                           |
| `CRON_SECRET`                                  | 本機 `openssl rand -hex 32`                                                                                       | Vercel、GitHub secret                                           | Vercel → Logs，看 `/api/cron/*` 的 401      |
| `BACKUP_PASSPHRASE`                            | 本機 `openssl rand -base64 32`。**舊備份仍要用舊密碼解開**，舊密碼保留在密碼管理器 14 天                          | GitHub secret、密碼管理器                                       | —                                           |
| `DISCORD_WEBHOOK_URL`                          | Discord → 頻道設定 → 整合 → Webhooks → 刪除，建立新的                                                             | Vercel、GitHub secret                                           | 頻道有沒有奇怪訊息                          |
| `TURNSTILE_SECRET_KEY`                         | Cloudflare → Turnstile → 該網站 → Rotate secret key                                                               | Vercel                                                          | —                                           |
| GitHub 帳號或 token                            | GitHub → Settings → Developer settings → 撤銷 token；改密碼、確認兩步驟驗證                                       | —                                                               | GitHub → Settings → Security log            |

**金鑰曾經被提交到 git**：只刪掉檔案不夠，歷史裡還在，而且 repo 是公開的。**一律視為已外洩，照上表換新**；要不要改寫歷史是次要的。

## 6. 資料外洩，或疑似被入侵

**如何發現**：Supabase 的 Logs 有大量陌生請求、`/admin/audit` 有不是你做的操作、使用者回報看到別人的資料、金鑰外洩通知。

**立即要做的事（SEV1）**

1. 開「維護模式」，阻止進一步的存取。
2. 換掉可能外洩的金鑰（第 5 節），**優先換 `SUPABASE_SERVICE_ROLE_KEY` 和資料庫密碼**。
3. 在 Supabase → Authentication → Users，登出所有人（Sign out all users）或撤銷可疑帳號的工作階段。
4. **保留證據**：先不要刪紀錄。匯出 Supabase Logs、`admin_audit`、`error_logs`、Vercel Logs。
5. 用 `npm run rls:check` 和 `docs/security.md` 的檢查清單找漏洞，修好後才解除維護。

**通知使用者**：確認有個資外洩時，依《個人資料保護法》第 12 條，要用適當方式通知受影響的當事人：說明外洩的事實、已採取的措施，以及當事人可以怎麼保護自己。必要時諮詢法律意見。公告範本：「我們發現 ○○ 期間有未經授權的存取，可能影響 ○○ 資料。我們已經 ○○。建議你 ○○。」

**事後檢討**：一定要寫，並更新 `docs/security.md` 的威脅模型。

## 7. 有人大量濫用

**如何發現**：通知「短時間大量註冊」「今日花費異常」；`/admin/abuse` 的自動標記（D162）；`/admin/users` 本月花費排行。

**立即要做的事**

- **大量註冊**：開關暫停「新註冊」（邀請連結也會一起擋）。到 `/admin/abuse` 看同一個 IP 或裝置建立的帳號，在 `/admin/users` 停用。設定 Turnstile（D160）。
- **灌爆 AI 額度**：
  - 自動偵測會先暫停該帳號的 AI 功能；
  - 到 `/admin/abuse` 確認後停用帳號；
  - 全站花費仍在上升時，暫停「AI 生成文字」「用指令修改」，必要時開唯讀模式；
  - 同時調低 `/admin/usage` 的每日上限。
- **上傳違法內容**：
  1. 在 `/admin/materials` 下架教材；
  2. 停用帳號；
  3. **保留證據**：先不要刪除檔案；
  4. 情節重大時（例如兒少性剝削內容）依法向 iWIN 網路內容防護機構或警方通報。

**如何恢復**：確認攻擊停止後再逐步打開開關。

## 8. 不當內容被公開分享

**如何發現**：檢舉（`/admin/reports`）、通知「短時間大量檢舉」、使用者回報。

**立即要做的事**

1. 在 `/admin/reports` 或 `/admin/materials` 把教材下架，立即生效。
2. 同一個作者有多份不當教材時，停用帳號。
3. 情況擴大（多人同時發布）：開關暫停「公開分享」（資料庫也會擋，D155）。
4. 侵權檢舉：依《著作權法》的通知與取下原則，先下架，再通知作者，可以申覆。

**通知使用者**：一般不公告；回覆檢舉人已處理。

## 9. AI 產生錯誤或不當內容

**如何發現**：「回報這句的問題」（`/admin/sentences`）、意見回饋、eval（D150）退步。

**立即要做的事**

1. 單一教材：在 `/admin/fixes` 修正，或下架。
2. 系統性的問題（例如提示詞被繞過、大量產生不當內容）：
   - 暫停「AI 生成文字」「用指令修改」；
   - 到 `/admin/usage` 看最近的呼叫，找出是哪個操作。
3. 在 `lib/evals/golden.ts` 加一個 `regression` 案例（CLAUDE.md 的規則），修正提示詞或後處理，跑 eval 確認沒有退步後再合併。

**通知使用者**：受影響的教材作者，在首頁通知（修正後會自動通知，D117）。

## 10. 監控本身停了

**如何發現**：`/status` 的「最近一次檢查」超過 1 小時；`/admin/ops` 沒有新的檢查紀錄。

**原因與處理**

- 公開 repo **60 天沒有 commit**，GitHub 會停用排程 → 到 Actions → Ops monitor → 「Enable workflow」。
- `CRON_SECRET` 在 Vercel 與 GitHub 不一致 → 兩邊重新設定成一樣的值。
- 網站壞掉：見第 4 節。

---

## 附錄：關鍵連結

| 服務         | 後台                                          | 狀態頁                              |
| ------------ | --------------------------------------------- | ----------------------------------- |
| Vercel       | <https://vercel.com/dashboard>                | <https://www.vercel-status.com/>    |
| Supabase     | <https://supabase.com/dashboard>              | <https://status.supabase.com/>      |
| Azure        | <https://portal.azure.com/>                   | <https://azure.status.microsoft/>   |
| GitHub       | <https://github.com/YA-CIAO-LIANG/listenloop> | <https://www.githubstatus.com/>     |
| Google Cloud | <https://console.cloud.google.com/>           | <https://status.cloud.google.com/>  |
| Cloudflare   | <https://dash.cloudflare.com/>                | <https://www.cloudflarestatus.com/> |
