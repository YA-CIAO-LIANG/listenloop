# 把 GitHub repo 改成私人：要注意的事（D134，2026-11-11；D163 更新，2026-11-13）

**2026-11-13（D163）：已改成私人。** 用 `gh repo edit --visibility private` 切換，切換後確認：

- 方案是 **GitHub Free**：分支保護與 rulesets 的 API 回「Upgrade to GitHub Pro or make this repository public」，所以 main 的分支保護已失效；照 CLAUDE.md，仍然必須等 CI 通過才合併。通過 Student Developer Pack（含 Pro）後要重新開啟。
- CI、Semgrep 在私人 repo 照常執行；Vercel 預覽與正式部署照常（之後的 PR 都有 Vercel 檢查，正式站已更新）。
- Dependabot 的安全性警示與自動安全性更新：切換後是關閉的，已用 API 重新開啟；版本更新（`dependabot.yml`）照常。
- 監控排程手動執行成功（健康檢查 HTTP 200）；網站自己的 15 分鐘監控在正式站正常寫入。
- 備份排程手動執行時，因為還沒設定 `SUPABASE_DB_URL`、`BACKUP_PASSPHRASE` 而在第一步停下（設計如此：沒有密碼絕不上傳）。

## D163：改私人前的準備

| 項目               | 公開 repo 時                                   | 私人 repo（D163）                                                                                                                      |
| ------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 健康檢查與監控     | GitHub Actions 每 15 分鐘                      | **UptimeRobot** 每 5 分鐘讀 `/api/health`，網站自己每 15 分鐘跑完整監控；Actions 每 6 小時一次當備援（`docs/uptime-monitoring.md`）    |
| 程式碼安全掃描     | CodeQL（私人 repo 要付費的 Advanced Security） | **Semgrep** 開源規則（JavaScript、TypeScript、React、Next.js、secrets），PR 改到程式時與每週一次；本機 `semgrep scan` 第一次結果：0 筆 |
| 金鑰掃描           | gitleaks（CI）                                 | 不變；每週的完整 CI 會掃描**完整歷史**                                                                                                 |
| 合併到 main 的 CI  | 每次合併都跑                                   | **不跑**（PR 已對同一份程式跑過）；改成每週三一次完整 CI，也可以手動執行                                                               |
| Dependabot         | 每週                                           | **每月**（每個 PR 都要花 CI 分鐘數；安全性更新仍然立即）                                                                               |
| 分鐘數不夠時的開關 | —                                              | repo 變數 `CI_LITE=on`：PR 的 CI 不跑 E2E（本機仍然必須跑過 E2E 才能推送）                                                             |
| 查詢本月用量       | —                                              | `npm run actions:usage`：本月每個工作流程的分鐘數與月底推估                                                                            |

### Actions 分鐘數估算（私人 repo 每月免費 2,000 分鐘）

2026-11-01～11-13 實測（`npm run actions:usage`，依每個 job 進位計算）：CI 共 1,279 分鐘（PR 733、合併到 main 546），CodeQL 47、ZAP 21，合計 1,356 分鐘，**照這個速度一個月約 3,300 分鐘**。這是一天合併十幾個 PR 的衝刺期。

改私人後每月估計：

| 工作流程           | 計算                                            | 一般月份（約 100 個 PR） | 衝刺月份（約 400 個 PR，同 11 月） |
| ------------------ | ----------------------------------------------- | -----------------------: | ---------------------------------: |
| CI（PR）           | 每個 PR 約 4.2 分；只改文件約 1 分              |                   約 420 |                           約 1,830 |
| CI（每週完整一次） | 4 次 × 約 5 分                                  |                       20 |                                 20 |
| Semgrep            | 改到程式的 PR × 約 1.5 分，加每週 4 次          |                   約 110 |                             約 450 |
| 監控備援（ops）    | 每 6 小時 1 次 × 30 天 + 每週摘要 4 次，各 1 分 |                      124 |                                124 |
| 每日備份           | 30 次 × 約 2 分（`BACKUP_SCHEDULE=on` 之後）    |                       60 |                                 60 |
| ZAP                | 每週 4 次 × 約 4 分，加改到標頭的 PR            |                    約 25 |                              約 40 |
| Dependabot PR      | 每月約 2～3 個 PR                               |                    約 15 |                              約 15 |
| 練習提醒、新聞教材 | 排程關閉                                        |                        0 |                                  0 |
| **合計**           |                                                 |               **約 770** |                       **約 2,540** |

- **一般月份遠低於 2,000 分鐘**。衝刺月份會超過：月中跑 `npm run actions:usage`，推估超過 1,600 分鐘時，設定 repo 變數 `CI_LITE=on`（PR 不跑 E2E，約可省 60%），下個月 1 日再改回。
- Semgrep 只在 PR 跑（不在合併到 main 時跑），ZAP 只在改到標頭時與每週跑。
- **沒有設定付款方式時，用完就停**：CI 無法執行就不能確認可以合併。建議到 GitHub → Settings → Billing and plans → Budgets and alerts，把 Actions 的預算設為 US$0（不會被收費），並開啟 75%、90% 的 email 提醒。

---

以下是 2026-11-11 的原始分析（D134）。

---

## 1. 目前每月用掉多少 Actions 分鐘

用 `gh api repos/YA-CIAO-LIANG/listenloop/actions/runs` 統計 2026-10-24 到 2026-11-11（19 天）：

| 工作流程                           | 次數 | 總時間（實際執行）                       |
| ---------------------------------- | ---: | ---------------------------------------- |
| CI（每個 PR、每次合併到 main）     |  360 | 約 971 分鐘                              |
| News materials、Practice reminders |    0 | 0（排程目前關閉，被跳過的 job 不計分鐘） |

- GitHub 按每個 job 無條件進位到整分鐘計費，所以實際計費大約是 **1,150 分鐘／19 天**。
- 換算下來，約 **每月 1,800 分鐘**。這是密集開發期的數字，平常會少很多。
- 每次 CI 原本要 4～6 分鐘：npm ci、lint、format、typecheck、單元測試、build、E2E。PR 跑一次，合併到 main 再跑一次一模一樣的。

**私人 repo 的額度**（GitHub Free 個人帳號）：每月 US$12 的免費運算額度，Linux 2 核每分鐘 US$0.006，約等於 **2,000 分鐘**。

- 沒有設定付款方式時，用完就停，CI 會無法執行，**PR 就無法合併**，因為分支保護需要 `check` 通過。
- 有設定付款方式時，超過的部分每分鐘 US$0.006，例如每月多 500 分鐘是 US$3。

## 2. 這次的優化（D134）

`.github/workflows/ci.yml` 仍然是一個名叫 `check` 的 job（分支保護依這個名字），只做這次變更需要的事：

| 變更                                    | 做什麼                                                                       |  大約時間 |
| --------------------------------------- | ---------------------------------------------------------------------------- | --------: |
| 只改文件（`docs/`、`*.md`）             | 格式檢查                                                                     |   約 1 分 |
| PR 改到程式                             | 格式檢查；lint、型別檢查、單元測試**同時跑**；build；E2E                     |   約 4 分 |
| 合併到 main                             | 格式檢查；lint、型別檢查、單元測試（同時跑）。E2E 在 PR 已經對同一份程式跑過 | 約 1.5 分 |
| 手動執行（Actions → CI → Run workflow） | 全部                                                                         |   約 4 分 |

- **快取**：npm 套件、Next.js build 快取（原本就有），加上 Playwright 的瀏覽器（新增，只在 Playwright 版本變更時重新下載）。
- **平行**：lint、型別檢查、單元測試在同一台機器上同時跑，三個的輸出都會分開顯示，任何一個失敗整個步驟就失敗。
- 只拆一個 job，不拆成好幾個：每個 job 各自無條件進位到整分鐘，又各自要裝一次套件，拆開反而更花分鐘數。
- **估計**：每月大約可以少 40%，從約 1,800 分鐘降到約 1,100 分鐘，在私人 repo 的 2,000 分鐘內。

**取捨**：合併到 main 時不跑 E2E。如果 PR 落後 main 很多，又在合併時才產生衝突的組合，就要等下一個 PR 才會發現。需要時，可以在 Actions 頁面手動執行完整的 CI。

## 3. 改成私人時要注意

1. **分支保護需要 GitHub Pro**：GitHub Free 的私人 repo 不能使用分支保護和 rulesets（只有公開 repo 可以）。改成私人後，「main 必須透過 PR、CI 通過才能合併」這條規則會**失效**。
   - 要維持這條規則，需要 GitHub Pro，每月 US$4（年繳 US$48），需要信用卡。Pro 每月的 Actions 免費額度也比 Free 多。
   - 不升級的話，我仍然會照工作規則等 CI 通過才合併（`gh pr merge --match-head-commit`），只是 GitHub 不會強制擋下。
2. **Actions 分鐘數**：見第 1、2 節。建議在 GitHub → Settings → Billing → Budgets 設定上限（例如 US$5），避免意外收費。
3. **練習提醒的排程**（`reminders.yml`，D111）：目前關閉。開啟時每 15 分鐘執行一次，一天 96 次、每次約 1 分鐘，一個月約 **2,900 分鐘**，一項就超過私人 repo 的額度。
   - 私人 repo 要開啟提醒的話，改成每小時一次（約 720 分鐘），或改用 Vercel Cron／Supabase pg_cron。要的話告訴我。
4. **Vercel 連動**：
   - repo 在你的個人帳號下（不是組織），Vercel Hobby 可以照常從私人 repo 自動部署與產生預覽網址，不需要改設定。
   - 如果之後把 repo 移到 GitHub 組織，Vercel Hobby **不支援組織的私人 repo**，要升級 Vercel Pro。
   - 改成私人後，到 Vercel → Settings → Git 確認仍然連著，再推一個小變更確認會自動部署。
5. **安全功能**：
   - 公開 repo 免費的 secret scanning 推送保護、CodeQL 程式碼掃描，私人 repo 需要付費的 GitHub Advanced Security，改成私人後會停止。
   - Dependabot 仍然可以用。
   - 本專案的金鑰都只放在環境變數，`.env.local` 不會提交，所以影響不大。
6. **連結與 fork**：README、作品集或文件裡的 GitHub 連結，改成私人後外人打不開（作品集若要展示程式碼，要另外處理）。現有的 fork 會和原 repo 分開。
7. **GitHub Pages、Packages**：本專案沒有使用。

## 4. 改成私人的步驟（決定之後）

1. （建議）先升級 GitHub Pro，或接受分支保護失效。
2. GitHub → repo → Settings → General → 最下方 Danger Zone → Change repository visibility → Make private。
3. 到 Settings → Branches 確認 `main` 的保護規則還在（Pro）。
4. 到 Settings → Billing → Budgets 設定 Actions 的預算上限。
5. Vercel：推一個小 PR，確認預覽網址和正式部署都正常。
6. 告訴我，我會更新 README 與作品集裡的連結。
