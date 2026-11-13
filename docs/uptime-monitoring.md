# 外部監控：UptimeRobot（D163，2026-11-13）

repo 改成私人後，GitHub Actions 的分鐘數有限（每月 2,000 分鐘），每 15 分鐘的健康檢查排程一個月就要 2,900 分鐘。所以改成：

| 誰                         | 多久一次   | 做什麼                                                                                                              |
| -------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| **UptimeRobot**（免費）    | 每 5 分鐘  | 讀 `/api/health`。網站掛掉或回應不是正常時，通知 Discord（和 email）。                                              |
| **網站自己**               | 每 15 分鐘 | `/api/health` 被讀到時，最多每 15 分鐘跑一次完整監控（錯誤率、額度、花費、濫用偵測），每天 03:00 後做一次每日清理。 |
| **GitHub Actions**（備援） | 每 6 小時  | 同樣讀 `/api/health` 並呼叫完整監控；台灣 03:00 那次做每日清理；每週一的成本摘要不變。                              |

- 完整監控由資料庫「搶鎖」（`claim_ops_run`）決定要不要跑：不管多少人、多頻繁讀 `/api/health`，最多 15 分鐘一次，不能被拿來打爆網站或 AI 供應者的免費連線檢查。
- `/api/health` 只回 `ok`／`degraded`／`down` 與各部分的 ok／fail，不洩漏任何數字或訊息（D156）。
- UptimeRobot 每 5 分鐘讀一次資料庫，也順便讓 Supabase 免費專案不會因為一週沒活動而暫停。

## 你要做的設定（約 10 分鐘）

1. 到 <https://uptimerobot.com> 註冊免費帳號（Free plan 不需要信用卡），**開啟兩步驟驗證**（My Settings → Two-factor authentication）。
2. **先建立 Discord 通知**：
   1. Discord：在要接收通知的頻道 → 編輯頻道 → 整合 → Webhook → 新增 Webhook → 複製網址（可以跟 `DISCORD_WEBHOOK_URL` 用同一個頻道、另開一個 webhook）。
   2. UptimeRobot：左側 **Integrations**（或 My Settings → Alert Contacts）→ **Discord** → 貼上 webhook 網址 → 名稱填「ListenLoop Discord」→ 儲存。
   3. 如果免費方案的 Discord 選項無法使用，改用 email（預設已有）和 UptimeRobot 手機 App 的推播。
3. **新增監控**：**+ New monitor**：
   - Monitor type：**Keyword**（比 HTTP 多檢查內容；選不到就選 HTTP(s)）。
   - URL：`https://listenloop-three.vercel.app/api/health`
   - Keyword：`"status":"ok"`；Alert when：**Keyword does not exist**（這樣「部分故障」`degraded` 也會通知）。
   - Friendly name：`ListenLoop health`
   - Monitoring interval：**5 minutes**
   - Alert contacts：勾選「ListenLoop Discord」與你的 email。
   - 儲存。
4. （選用）**Status page**：UptimeRobot 可以建立公開狀態頁，但網站已經有自己的 `/status`，不需要。
5. 確認：幾分鐘後，Dashboard 顯示綠色 Up；到 Supabase → Table Editor → `ops_runs` 看到 `monitor` 的時間每 15 分鐘更新（需要 Vercel 已設定 `SUPABASE_SERVICE_ROLE_KEY`，目前已設定）。
6. 換網域時，記得改監控網址。

## 測試通知

UptimeRobot 監控頁 → 右上角 **Test notification**（或暫時把 Keyword 改成不存在的字）：Discord 頻道應該收到訊息，測完改回。
