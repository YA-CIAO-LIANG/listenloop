import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { ADMIN_PAGE_ROWS } from "@/lib/admin-dashboard";
import { rankHardSentences } from "@/lib/hard-sentences";
import { parseCustomPracticeId } from "@/lib/practice-material";
import { getVideoIncludingDrafts } from "@/lib/video-library";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.sentences");
  return { title: t("title") };
}

/** Reports read for the ranking (the newest). */
const ISSUES_READ = 2000;

/**
 * Sentences shadowing keeps failing on (D52, D56): skips, reports, and
 * average coverage, worst first. Each links to where it can be fixed:
 * a created practice's edit page, or a built-in video's page.
 */
export default async function AdminSentencesPage() {
  const [t, format] = await Promise.all([
    getTranslations("admin.sentences"),
    getFormatter(),
  ]);
  const admin = getAdminSupabase();
  const { data: issues } = admin
    ? await admin
        .from("shadowing_issues")
        .select("video_id, sentence_index, coverages, skipped, created_at")
        .order("created_at", { ascending: false })
        .limit(ISSUES_READ)
    : { data: null };
  const ranked = rankHardSentences(issues ?? []).slice(0, ADMIN_PAGE_ROWS);

  // The sentence text: from the video file, or the practice's current rows.
  const practiceIds = [
    ...new Set(ranked.flatMap((r) => parseCustomPracticeId(r.videoId) ?? [])),
  ];
  const { data: rows } =
    admin && practiceIds.length
      ? await admin
          .from("practice_sentences")
          .select("practice_id, i, en, practices(title, user_id)")
          .in("practice_id", practiceIds)
      : { data: null };
  const textOf = (videoId: string, index: number) => {
    const uuid = parseCustomPracticeId(videoId);
    if (uuid) {
      const row = rows?.find((r) => r.practice_id === uuid && r.i === index);
      return { title: row?.practices?.title ?? videoId, en: row?.en ?? "" };
    }
    const video = getVideoIncludingDrafts(videoId);
    return {
      title: video?.title ?? videoId,
      en: video?.sentences[index]?.en ?? "",
    };
  };
  const percent = (value: number) =>
    format.number(value, { style: "percent", maximumFractionDigits: 0 });

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      {ranked.length === 0 ? (
        <p className="mt-8 text-ink-muted">{t("none")}</p>
      ) : (
        <ol className="mt-8 max-w-practice divide-y divide-line border-y border-line">
          {ranked.map((item) => {
            const { title, en } = textOf(item.videoId, item.sentenceIndex);
            const uuid = parseCustomPracticeId(item.videoId);
            return (
              <li
                key={`${item.videoId}#${item.sentenceIndex}`}
                className="space-y-2 py-4"
              >
                <p className="text-supporting text-ink-muted">
                  {t("where", { title, n: item.sentenceIndex + 1 })}
                </p>
                <p lang="en" className="text-sentence">
                  {en || t("missing")}
                </p>
                <p className="text-supporting tabular-nums">
                  {t("stats", {
                    skips: item.skips,
                    reports: item.reports,
                    coverage: percent(item.averageCoverage),
                  })}
                </p>
                <Link
                  href={
                    uuid ? `/materials/${uuid}/edit` : `/videos/${item.videoId}`
                  }
                  className="text-supporting text-accent-ink underline underline-offset-4"
                >
                  {uuid ? t("edit") : t("open")}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
