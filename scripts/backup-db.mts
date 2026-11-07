/**
 * Manual backup of the database's data (D63): every table, as JSON files
 * in backups/<date-time>/, plus the list of audio files in Storage. Uses
 * the secret key from .env.local, so it reads everything; the backups
 * folder is git-ignored and holds personal data: keep it private.
 *
 *   npm run db:backup
 *
 * For a full SQL dump (schema and data, restorable with psql), see
 * docs/backup.md.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });

const TABLES = [
  "profiles",
  "progress",
  "user_documents",
  "collections",
  "practices",
  "practice_sentences",
  "practice_versions",
  "practice_reports",
  "speech_audio",
  "ai_cache",
  "api_usage",
  "api_daily_cost",
  "api_calls",
  "events",
  "shadowing_issues",
  "feedback",
  "admin_audit",
  "error_logs",
];
const PAGE = 1000;

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = join("backups", stamp);
mkdirSync(dir, { recursive: true });

for (const table of TABLES) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows, null, 2));
  console.log(`${table}: ${rows.length} rows`);
}

const files: string[] = [];
for (let offset = 0; ; offset += PAGE) {
  const { data, error } = await admin.storage
    .from("speech")
    .list("", { limit: PAGE, offset });
  if (error) throw new Error(`storage: ${error.message}`);
  files.push(...data.map((file) => file.name));
  if (data.length < PAGE) break;
}
writeFileSync(join(dir, "speech-files.json"), JSON.stringify(files, null, 2));
console.log(
  `speech files: ${files.length} (names only; audio can be made again)`,
);
console.log(`\nSaved to ${dir}`);
