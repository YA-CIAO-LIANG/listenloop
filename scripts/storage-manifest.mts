/**
 * The Storage file list for the daily backup (D157):
 *   node scripts/storage-manifest.mts <output.json>
 * Every file in the `speech` bucket (generated audio: it can be made
 * again from the text and voice, so only names are kept) and in
 * `uploads` (learners' recordings, one folder per account), with size
 * and time. File contents aren't copied: the free tier has no room for
 * a second copy, and the list says what to make again or ask for.
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const out = process.argv[2];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!out || !url || !key) {
  console.error("Usage: node scripts/storage-manifest.mts <output.json>");
  console.error(
    "Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const PAGE = 1000;

type Entry = { path: string; bytes: number | null; updatedAt: string | null };

async function list(bucket: string, prefix: string): Promise<Entry[]> {
  const entries: Entry[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      // A folder has no id; look inside it.
      if (item.id === null) entries.push(...(await list(bucket, path)));
      else {
        entries.push({
          path,
          bytes: Number(item.metadata?.size ?? 0) || null,
          updatedAt: item.updated_at ?? null,
        });
      }
    }
    if (data.length < PAGE) break;
  }
  return entries;
}

const manifest: Record<string, Entry[]> = {};
for (const bucket of ["speech", "uploads"]) {
  manifest[bucket] = await list(bucket, "");
  console.log(`${bucket}: ${manifest[bucket].length} files`);
}
writeFileSync(
  out,
  JSON.stringify({ madeAt: new Date().toISOString(), ...manifest }, null, 2),
);
