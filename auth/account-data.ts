import type { Supabase } from "@/lib/supabase/browser";
import { SPEECH_BUCKET, UPLOADS_BUCKET } from "@/lib/supabase/config";

/**
 * Everything ListenLoop keeps about one account (D60), for "Download my
 * data": read with the secret key, since some of it (activity, reports)
 * users can't read themselves. Never another user's data: every query is
 * filtered by this account's id.
 */
export async function exportAccountData(admin: Supabase, userId: string) {
  const own = <T extends string>(table: T, column = "user_id") =>
    admin
      .from(table as "profiles")
      .select("*")
      .eq(column as "user_id", userId);
  const [
    profile,
    progress,
    documents,
    practices,
    collections,
    events,
    issues,
    feedback,
    reports,
    calls,
    quizzes,
  ] = await Promise.all([
    own("profiles"),
    own("progress"),
    own("user_documents"),
    admin
      .from("practices")
      .select("*, practice_sentences(*), practice_versions(*)")
      .eq("user_id", userId),
    own("collections"),
    own("events"),
    own("shadowing_issues"),
    own("feedback"),
    own("practice_reports", "reporter_id"),
    admin
      .from("api_calls")
      .select(
        "created_at, provider, operation, input_tokens, output_tokens, chars, cost_micros, error",
      )
      .eq("user_id", userId),
    own("vocab_quiz_attempts"),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    profile: profile.data?.[0] ?? null,
    progress: progress.data ?? [],
    documents: documents.data ?? [],
    practices: practices.data ?? [],
    collections: collections.data ?? [],
    activity: events.data ?? [],
    hardSentenceReports: issues.data ?? [],
    feedback: feedback.data ?? [],
    reportsYouMade: reports.data ?? [],
    apiUsage: calls.data ?? [],
    vocabQuizzes: quizzes.data ?? [],
  };
}

/**
 * The audio files only this account's practices use (D60): the paths of
 * its sentences and version snapshots that no other account's practice
 * uses too. Files are shared by content (D22), so a file another practice
 * uses stays.
 */
export async function audioOnlyFor(
  admin: Supabase,
  userId: string,
): Promise<string[]> {
  const { data: mine } = await admin
    .from("practices")
    .select("id, practice_sentences(audio_path), practice_versions(sentences)")
    .eq("user_id", userId);
  const paths = new Set<string>();
  for (const practice of mine ?? []) {
    for (const s of practice.practice_sentences) {
      if (s.audio_path) paths.add(s.audio_path);
    }
    for (const v of practice.practice_versions) {
      for (const s of (Array.isArray(v.sentences) ? v.sentences : []) as {
        audio_path?: unknown;
      }[]) {
        if (typeof s?.audio_path === "string") paths.add(s.audio_path);
      }
    }
  }
  if (paths.size === 0) return [];
  const ids = (mine ?? []).map((p) => p.id);
  // In chunks, to keep each request's URL short.
  const all = [...paths];
  for (let start = 0; start < all.length; start += 100) {
    const { data: shared } = await admin
      .from("practice_sentences")
      .select("audio_path")
      .in("audio_path", all.slice(start, start + 100))
      .not("practice_id", "in", `(${ids.join(",")})`);
    for (const row of shared ?? []) {
      if (row.audio_path) paths.delete(row.audio_path);
    }
  }
  return [...paths];
}

/** Removes audio files and their cache rows (D60). */
export async function removeAudio(admin: Supabase, paths: readonly string[]) {
  if (paths.length === 0) return;
  const { error } = await admin.storage.from(SPEECH_BUCKET).remove([...paths]);
  if (error) throw new Error(error.message);
  await admin
    .from("speech_audio")
    .delete()
    .in("path", [...paths]);
}

/** Removes every recording the user uploaded (D130): their folder. */
export async function removeUploads(admin: Supabase, userId: string) {
  for (;;) {
    const { data, error } = await admin.storage
      .from(UPLOADS_BUCKET)
      .list(userId, { limit: 100 });
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return;
    const { error: removeError } = await admin.storage
      .from(UPLOADS_BUCKET)
      .remove(data.map((file) => `${userId}/${file.name}`));
    if (removeError) throw new Error(removeError.message);
    if (data.length < 100) return;
  }
}
