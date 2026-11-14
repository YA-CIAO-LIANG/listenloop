# 部署出問題時的回復（D157）

新版本上線後網站壞掉時，**先回到上一個正常的版本，再慢慢修**。Vercel 保留每一次部署，切換只要幾秒鐘，不需要重新 build。

## 1. 什麼時候要回滾

- 合併後，`/api/health` 不是 200，或監控通知「健康檢查失敗」「錯誤率突然升高」；
- 主要流程壞掉，例如無法登入、練習頁打不開、建立教材全部失敗；
- 修正需要超過 15 分鐘。

只是小問題（文字錯、版面小跑位）時，直接開 PR 修正就好。

## 2. Vercel 立即回滾（Instant Rollback）

**用後台（最簡單）**

1. 打開 <https://vercel.com/dashboard>，進入 `listenloop` 專案，再點上方的 **Deployments**。
2. 找到出問題之前、狀態是 **Ready** 的 Production 部署。用時間和 commit 訊息判斷，通常是第二新的那一個。
3. 點右邊的 **⋯** → **Instant Rollback**，再按確認。
4. 大約 10 秒後生效。打開 <https://listenloop-three.vercel.app/api/health>，確認回應是 `"status":"ok"`。

**用指令（需要先 `npm i -g vercel` 並 `vercel login`）**

```
vercel rollback               # 回到上一個 Production 部署
vercel rollback <部署網址>     # 回到指定的部署
```

**注意**

- 回滾後，Vercel 會**暫停自動部署**到 Production，避免下一次合併又把壞的版本推上去。修好之後，到專案頁按 **Undo Rollback**，或把修正後的部署 **Promote to Production**，自動部署就會恢復。
- 環境變數是跟著部署走的。如果問題是環境變數改錯了，回滾無效：要改回環境變數，再 **Redeploy**。
- **能回滾到哪幾個版本**（D175）：為了 Vercel Hobby 的函式儲存空間上限（10 GB），舊部署會用 `npm run vercel:prune` 清掉。它一定保留目前的 Production 和 **3 個較新的 Production 部署**，所以最近 3 個版本一定可以 Instant Rollback。
  - 回滾之後才執行清除也安全：它保留的是「Production 目前指向的部署」，不是最新的那一個。
  - 要回到更舊的版本：在 git 上 revert（第 3 節），或在 Vercel 對那個 commit 重新部署。
  - 要多留幾個：`npm run vercel:prune -- --keep 5`。詳見 `docs/capacity.md` 第 8 節。

## 3. 在 git 上修正

回滾只是止血，main 上的程式還是壞的。

1. 找出造成問題的 PR，用 `git revert` 開一個還原的 PR（例如 `fix/revert-<PR 編號>`）：
   ```
   git checkout main && git pull
   git checkout -b fix/revert-123
   git revert -m 1 <合併 commit 的 hash>
   git push -u origin fix/revert-123
   ```
2. CI 通過後合併。Vercel 會部署新的 main，這時再按 **Undo Rollback**（見上）。
3. 之後再另外開 PR，重新做那個功能，並補上抓得到這個錯誤的測試。

## 4. 資料庫怎麼辦

- **原則：程式回滾，資料庫不回滾。** 我們的 migration 都是「只新增」，舊版程式不會用到新的資料表或欄位，所以兩者可以共存。
- 新的 migration 會讓舊版程式出錯時（例如改了欄位名稱或刪除東西），照 `docs/migrations-rollback.md` 回復那個 migration，**先備份**。
- 因此要避免一次就破壞相容性的 migration。要改名或刪除時分兩步：先新增並讓程式同時支援新舊兩種，下一個 PR 才刪除舊的。

## 5. 事後

- SEV1、SEV2 要寫事後檢討（`docs/postmortem-template.md`）。
- 在「逃脫的錯誤」（`docs/ai-dev-log.md`）記錄原因、測試為什麼沒抓到，以及補上的測試。
