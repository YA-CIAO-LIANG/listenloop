import type { getAdminSupabase } from "./admin";

type Admin = NonNullable<ReturnType<typeof getAdminSupabase>>;

/**
 * The daily clean-up of files no material uses (D161): generated audio
 * that no sentence or saved version points to, and recordings no
 * practice was made from, after a week (so a practice being made right
 * now is never touched). Its database rows go too (speech_audio), so the
 * audio cache doesn't hand out a missing file.
 *
 * A safety check: if more than ORPHAN_MAX_SHARE of a bucket looks
 * unused, something is wrong (a bug, a half-restored backup), so nothing
 * is deleted and the monitor raises an alert instead.
 */
export const ORPHAN_AGE_DAYS = 7;
export const ORPHAN_MAX_SHARE = 0.2;
export const ORPHAN_MAX_PER_RUN = 500;

export type OrphanResult =
  | { status: "done"; deleted: Record<string, number> }
  | { status: "held"; bucket: string; orphans: number; files: number };

export async function cleanOrphans(
  admin: Admin,
  now: Date,
): Promise<OrphanResult> {
  const olderThan = new Date(
    now.getTime() - ORPHAN_AGE_DAYS * 86_400_000,
  ).toISOString();
  const [{ data: rows, error }, { data: counts }] = await Promise.all([
    admin.rpc("orphan_audio", {
      older_than: olderThan,
      max_rows: ORPHAN_MAX_PER_RUN,
    }),
    admin.rpc("storage_file_counts"),
  ]);
  if (error) throw new Error(`orphan_audio: ${error.message}`);
  const byBucket = new Map<string, string[]>();
  for (const row of rows ?? []) {
    byBucket.set(row.bucket, [...(byBucket.get(row.bucket) ?? []), row.path]);
  }
  for (const [bucket, paths] of byBucket) {
    const files = Number(counts?.find((c) => c.bucket === bucket)?.files ?? 0);
    if (files === 0 || paths.length / files > ORPHAN_MAX_SHARE) {
      return { status: "held", bucket, orphans: paths.length, files };
    }
  }
  const deleted: Record<string, number> = {};
  for (const [bucket, paths] of byBucket) {
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      const { error: removeError } = await admin.storage
        .from(bucket)
        .remove(batch);
      if (removeError)
        throw new Error(`remove ${bucket}: ${removeError.message}`);
      if (bucket === "speech") {
        await admin.from("speech_audio").delete().in("path", batch);
      }
      deleted[bucket] = (deleted[bucket] ?? 0) + batch.length;
    }
  }
  return { status: "done", deleted };
}
