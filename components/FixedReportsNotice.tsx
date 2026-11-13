import { getTranslations } from "next-intl/server";
import { getServerSupabase } from "@/auth/server";
import { getSignedInUser } from "@/auth/session";
import { parseCustomPracticeId } from "@/lib/practice-material";
import { practiceTitles } from "@/lib/titles";
import { getVideoIncludingDrafts } from "@/lib/video-library";
import { FixedReportsDismiss } from "./FixedReportsDismiss";

/**
 * "Your reports were fixed" (D113): on the home page, the sentences this
 * learner reported that an admin has since fixed, until they say got it.
 */
export async function FixedReportsNotice() {
  const [user, supabase] = await Promise.all([
    getSignedInUser(),
    getServerSupabase(),
  ]);
  if (!user || !supabase) return null;
  const { data: reports } = await supabase
    .from("sentence_reports")
    .select("id, video_id, sentence_index, kind, resolution_note")
    .eq("user_id", user.id)
    .eq("status", "fixed")
    .is("notified_at", null)
    .order("resolved_at", { ascending: true })
    .limit(10);
  if (!reports?.length) return null;
  const t = await getTranslations("sentenceReport");
  const uuids = [
    ...new Set(reports.flatMap((r) => parseCustomPracticeId(r.video_id) ?? [])),
  ];
  const { data: practices } = uuids.length
    ? await supabase
        .from("practices")
        .select("id, title, title_en, title_zh")
        .in("id", uuids)
    : { data: null };
  const titleOf = (videoId: string) => {
    const uuid = parseCustomPracticeId(videoId);
    if (!uuid) return getVideoIncludingDrafts(videoId)?.title ?? videoId;
    const row = practices?.find((p) => p.id === uuid);
    return row ? practiceTitles(row).en || row.title : videoId;
  };
  return (
    <section
      aria-labelledby="fixed-reports"
      className="rounded-base border border-line surface-card p-6"
    >
      <h2 id="fixed-reports" className="font-display text-h3">
        <span aria-hidden="true" className="text-success">
          ✓{" "}
        </span>
        {t("fixedTitle")}
      </h2>
      <ul className="mt-3 space-y-1 text-supporting">
        {reports.map((report) => (
          <li key={report.id}>
            {t("fixedLine", {
              title: titleOf(report.video_id),
              n: report.sentence_index + 1,
              kind: t(`kinds.${report.kind as "translation"}`),
            })}
            {report.resolution_note && (
              <span className="text-ink-muted">
                {" · "}
                {report.resolution_note}
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <FixedReportsDismiss ids={reports.map((report) => report.id)} />
      </div>
    </section>
  );
}
