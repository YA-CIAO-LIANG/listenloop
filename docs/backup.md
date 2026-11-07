# 資料庫備份（D63）

建議每週備份一次，正式收費或有大量使用者後改成每天。Supabase 免費方案**沒有**自動備份可以還原，所以手動備份很重要。

## 方法一：JSON 匯出（最簡單）

```
npm run db:backup
```

- 每張資料表存成一個 JSON 檔，放在 `backups/<日期時間>/`。
- 另外存一份音檔清單（`speech-files.json`）。音檔本身可以用相同的文字和聲音重新產生，所以只存檔名。
- 需要 `.env.local` 裡的 `NEXT_PUBLIC_SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`。
- `backups/` 已經列在 `.gitignore`，**不會被提交**。裡面有個人資料（email 以外的帳號資料、進度、回饋），請存在加密的地方（例如有密碼的壓縮檔、加密的外接硬碟），不要上傳到公開的雲端資料夾。

## 方法二：完整 SQL 備份（可以直接還原）

需要資料庫密碼（Supabase 後台 → Project Settings → Database → Database password；忘記可以重設）。

```
npx supabase@3.0.0 db dump --linked -f backups/schema.sql
npx supabase@3.0.0 db dump --linked --data-only -f backups/data.sql
```

- `schema.sql`：資料表、函式、RLS 規則。
- `data.sql`：所有資料。

### 還原（緊急時）

1. 在 Supabase 建立新專案，或確認要覆蓋的專案。
2. 取得新專案的連線字串（Project Settings → Database → Connection string → URI）。
3. 依序執行：
   ```
   psql "<連線字串>" -f backups/schema.sql
   psql "<連線字串>" -f backups/data.sql
   ```
4. 更新 Vercel 的 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`，重新部署。
5. 用 `npm run rls:check` 確認權限規則正確。

## 定期提醒

可以在行事曆設每週一次「ListenLoop 備份」，執行方法一即可。
