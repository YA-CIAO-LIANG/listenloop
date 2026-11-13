# 資料庫備份與還原（D63、D157）

Supabase 免費方案**沒有**可以還原的自動備份，所以由我們自己每天備份。

## 1. 每日自動備份（D157）

`.github/workflows/backup.yml` 每天台灣時間 02:00 執行：

1. 用 Supabase 官方的 `supabase db dump`，存三個檔案：`roles.sql`（角色）、`schema.sql`（資料表、函式、RLS）、`data.sql`（所有資料，包括帳號）。
2. 用 `scripts/storage-manifest.mts` 存 Storage 的檔案清單：`speech`（產生的音檔，可以用同樣的文字與聲音重新產生）和 `uploads`（使用者的錄音）。只存檔名、大小與時間，不存檔案內容。
3. 用 `scripts/backup-encrypt.sh` 打包並加密：AES-256，金鑰由 `BACKUP_PASSPHRASE` 經 PBKDF2（60 萬次）產生，每次的 salt 都不同。
4. 上傳成 GitHub Actions 的 artifact `listenloop-backup`，**保留 14 天**，之後 GitHub 自動刪除。

**為什麼一定要加密**：repo 是公開的，**任何人都能下載公開 repo 的 Actions artifact**。加密腳本有三道防護：

- 沒有密碼（或密碼少於 20 字）時直接失敗；
- 檢查輸出檔是加密格式（`Salted__` 開頭）；
- 檢查輸出檔裡沒有 `PGDMP`、`CREATE TABLE`、`COPY public.` 這類明文特徵。

任何一項不通過，就不會上傳。加密完成後，runner 上的明文檔也會刪除。

**開啟方式**（Joe 要做，詳細步驟見 `docs/roadmap.md`）：

- 設定 GitHub secrets：`SUPABASE_DB_URL`、`BACKUP_PASSPHRASE`、`NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`。
- 設定 repo 變數 `BACKUP_SCHEDULE=on`。

**`BACKUP_PASSPHRASE` 要另外存在密碼管理器。** 弄丟了，所有備份都解不開；換新密碼後，舊備份仍要用舊密碼解開，所以舊密碼至少保留 14 天。

## 2. 還原步驟（緊急時）

需要：`gh`（GitHub CLI，已登入）、`openssl`、`psql`（`brew install postgresql@17`），以及 `BACKUP_PASSPHRASE`。

1. **下載最新的備份**：
   ```
   gh run list --workflow backup.yml --limit 5      # 找最近成功的那一次
   gh run download <run id> -n listenloop-backup -D ~/listenloop-restore
   ```
2. **解密**（會要你輸入密碼；不要把密碼寫進指令歷史）：
   ```
   read -rs BACKUP_PASSPHRASE && export BACKUP_PASSPHRASE
   bash scripts/backup-decrypt.sh ~/listenloop-restore/listenloop-backup-*.tar.gz.enc ~/listenloop-restore/files
   ```
3. **準備目標資料庫**：
   - 還原到原本的專案：先確認真的要覆蓋，覆蓋前再備份一次目前的狀態。
   - 還原到新專案：在 Supabase 建立新專案（同一個區域）。
4. **取得連線字串**：Supabase → Project Settings → Database → Connection string → **Session pooler**（URI，換上資料庫密碼）。
5. **依序還原**（官方建議的方式；資料匯入時暫停觸發器，避免重複執行建立 profile 等動作）：
   ```
   psql "<連線字串>" -v ON_ERROR_STOP=1 \
     --single-transaction \
     -f ~/listenloop-restore/files/roles.sql \
     -f ~/listenloop-restore/files/schema.sql \
     -c 'SET session_replication_role = replica' \
     -f ~/listenloop-restore/files/data.sql
   ```
6. **新專案才需要**：更新 Vercel 的 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`，並在 Supabase → Authentication 重新設定 Google、LINE 登入與網址，然後重新部署。
7. **Storage**：
   - `speech` 的音檔可以用後台的「繼續準備」重新產生；
   - `uploads` 的錄音如果遺失，依 `storage-files.json` 通知受影響的使用者；
   - 建立兩個 bucket 的設定已經包含在 `schema.sql`。
8. **檢查**：`npm run rls:check`、打開 `/api/health`、用一般帳號登入並打開一份練習。

## 3. 演練紀錄

`bash scripts/restore-drill.sh` 在本機用暫時的 PostgreSQL 跑完整流程，不碰正式資料：

1. 套用所有 migration（加上 Supabase 的最小替身 `scripts/drill/supabase-shim.sql`），並放入範例資料；
2. 用和 workflow 一樣的方式備份並加密；
3. 用上面第 2 節的方式解密並還原到一個全新的資料庫；
4. 比對每張表的筆數與 RLS 規則數。

| 日期       | 結果 | 範圍                                                                                        | 花費時間                                                                       |
| ---------- | ---- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 2026-11-13 | 通過 | 57 個 migration、50 張表全部筆數一致、43 條 RLS 規則一致；範例資料約 6,800 筆（200 個帳號） | 全程 **約 3 秒**（建立 1 秒、備份加密不到 1 秒、解密還原 1 秒、比對不到 1 秒） |

- **正式環境的估計**：目前資料庫 27 MB，`supabase db dump` 加上下載約 1～2 分鐘，還原約 1～3 分鐘。加上建立新專案、更新 Vercel 設定與重新部署，**從開始還原到網站恢復大約 30 分鐘**。
- 另外驗證過：密碼錯誤時無法解密（`bad decrypt`）；沒有密碼時加密腳本直接拒絕，不會產生檔案。
- **建議每季演練一次**（`bash scripts/restore-drill.sh`），並在這張表加一列。

## 4. 手動 JSON 匯出（舊方法，仍可使用）

```
npm run db:backup
```

每張資料表存成一個 JSON 檔，放在 `backups/<日期時間>/`（已列在 `.gitignore`），需要 `.env.local` 的 `NEXT_PUBLIC_SUPABASE_URL` 與 `SUPABASE_SERVICE_ROLE_KEY`。內容有個人資料，請存在加密的地方。這個方法無法直接還原 schema，只適合查資料。
