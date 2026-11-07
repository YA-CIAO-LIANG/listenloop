# 自動續做（D65）

讓 Claude Code 每 6 小時在背景執行一次「繼續 roadmap」。**目前已經建立好，但沒有安裝、也沒有啟用**：會在背景常駐執行的設定，要由 Joe 本人決定是否開啟。

## 它會做什麼、不會做什麼

- 執行前先用 `pmset -g ps` 確認接著電源；**用電池就略過**，並寫進紀錄。
- 用鎖定資料夾避免同時執行兩次；執行時用 `caffeinate` 防止睡眠；**最長 3 小時**，到時間自動停止。
- `docs/roadmap.md` 沒有任何未勾選的項目（`- [ ]`）時，**自動停用排程**。
- 只允許列出的工具：讀寫程式、git、gh 的 PR 指令、npm 的檢查／測試／建置、只新增欄位的 migration（`db:push`）。**不跳過權限檢查**。
- **不允許**：Vercel 指令（改環境變數）、`npx supabase`（含重設資料庫）、強制推送、`git reset --hard`、`rm -rf`、`curl`；也不允許真實 API 的錄製與建立官方教材（`LISTENLOOP_UNATTENDED=1` 會讓這些腳本直接拒絕）。
- 遇到需要 Joe 的事，會寫進 roadmap 後停下來。

## 安裝與啟用

```
scripts/auto-continue/install.sh
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.listenloop.auto-continue.plist
```

第一個指令只把設定檔放到 `~/Library/LaunchAgents/`，不會啟用；第二個指令才會開始排程（啟用後 6 小時第一次執行）。

想立刻試跑一次：

```
launchctl kickstart gui/$(id -u)/com.listenloop.auto-continue
```

## 暫停與恢復

```
launchctl bootout gui/$(id -u)/com.listenloop.auto-continue      # 暫停
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.listenloop.auto-continue.plist   # 恢復
```

## 看紀錄

```
tail -50 ~/Library/Logs/listenloop-auto/$(date +%Y-%m).log
```

每次執行都會記錄：開始時間、電源狀態、是否略過與原因、Claude 的輸出（做了什麼）、結束原因（完成、超過時間、錯誤代碼）。launchd 本身的訊息在同一個資料夾的 `launchd.*.log`。

## 移除

```
scripts/auto-continue/uninstall.sh
```

會停用並刪除設定檔；紀錄保留。

## 注意

- 需要先在終端機用 `claude` 登入過，背景執行才能使用同一個帳號。
- 背景執行會使用 Claude 的用量額度。如果想限制，可以在 `run.sh` 的 `claude -p` 加上 `--max-budget-usd`（只對 API 金鑰計費的帳號有效）。
- 改 `scripts/auto-continue/run.sh` 後不用重新安裝；改 `.plist` 後要重新執行 install 並重新啟用。
