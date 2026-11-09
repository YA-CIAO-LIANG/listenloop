import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { ScrollRegion } from "@/components/ScrollRegion";
import { StatTile } from "@/components/StatTile";
import { taiwanToday } from "@/lib/admin-dashboard";
import { isCategoryId } from "@/lib/categories";
import { VIDEO_CATEGORY_IN_LIBRARY } from "@/lib/library";
import { parseCustomPracticeId } from "@/lib/practice-material";
import {
  activeDays,
  addDay,
  loopCompletion,
  retention,
  weeklyActive,
} from "@/lib/retention";
import { getVideoIncludingDrafts } from "@/lib/video-library";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.retention");
  return { title: t("title") };
}

/** Events are kept 180 days (D55): retention is judged within them. */
const EVENT_DAYS = 180;
/** Rows read per request (PostgREST returns at most 1,000 at a time). */
const PAGE = 1000;
/** Pages read at most per table, to keep the page quick. */
const MAX_PAGES = 100;

/**
 * Retention and completion (D114): day 1, 7, and 30 retention by sign-up,
 * weekly active learners, and how many started materials reach the end
 * of a 7-day loop, overall and by category. Totals only.
 */
export default async function AdminRetentionPage() {
  const [t, tCategories, format] = await Promise.all([
    getTranslations("admin.retention"),
    getTranslations("categories.names"),
    getFormatter(),
  ]);
  const admin = getAdminSupabase();
  const today = taiwanToday(new Date());
  const since = addDay(today, -EVENT_DAYS);

  async function all<T>(
    read: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
  ): Promise<T[]> {
    const out: T[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data } = await read(page * PAGE, page * PAGE + PAGE - 1);
      out.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    return out;
  }

  const [users, events, progress] = admin
    ? await Promise.all([
        all((from, to) =>
          admin
            .from("profiles")
            .select("user_id, created_at")
            .order("created_at")
            .range(from, to),
        ),
        all((from, to) =>
          admin
            .from("events")
            .select("user_id, created_at")
            .gte("created_at", `${since}T00:00:00+08:00`)
            .order("created_at")
            .range(from, to),
        ),
        all((from, to) =>
          admin
            .from("progress")
            .select("video_id, data")
            .order("user_id")
            .range(from, to),
        ),
      ])
    : [[], [], []];

  // Categories of created materials, for completion by category.
  const uuids = [
    ...new Set(
      progress.flatMap((p) => parseCustomPracticeId(p.video_id) ?? []),
    ),
  ];
  const categories = new Map<string, string | null>();
  for (let i = 0; admin && i < uuids.length; i += 200) {
    const { data } = await admin
      .from("practices")
      .select("id, category")
      .in("id", uuids.slice(i, i + 200));
    for (const row of data ?? []) categories.set(row.id, row.category);
  }
  const categoryOf = (videoId: string) => {
    const uuid = parseCustomPracticeId(videoId);
    if (uuid) return categories.get(uuid) ?? null;
    const video = getVideoIncludingDrafts(videoId);
    return video ? (VIDEO_CATEGORY_IN_LIBRARY[video.category] ?? null) : null;
  };

  const active = activeDays(events);
  const rates = retention(users, active, today, since);
  const weeks = weeklyActive(active, today);
  const loops = loopCompletion(progress, categoryOf);
  const percent = (n: number | null) =>
    n === null
      ? "—"
      : format.number(n, { style: "percent", maximumFractionDigits: 1 });
  const categoryName = (id: string) =>
    isCategoryId(id) ? tCategories(id) : t("noCategory");

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">
        {t("intro", { days: EVENT_DAYS })}
      </p>
      {!admin && <p className="mt-4 text-error">{t("noKey")}</p>}

      <dl className="mt-8 grid grid-cols-2 gap-4 wide:grid-cols-4">
        {rates.map((r) => (
          <StatTile
            key={r.day}
            label={t("retention", { day: r.day })}
            value={percent(r.rate)}
            note={t("retentionNote", {
              retained: r.retained,
              eligible: r.eligible,
            })}
          />
        ))}
        <StatTile
          label={t("loops")}
          value={percent(loops.overall.rate)}
          note={t("loopsNote", {
            finished: loops.overall.finished,
            started: loops.overall.started,
          })}
        />
      </dl>

      <section className="mt-12 space-y-3">
        <h2 className="font-display text-h2">{t("weeklyTitle")}</h2>
        <ScrollRegion label={t("weeklyTitle")}>
          <table className="w-full min-w-120 text-left text-supporting tabular-nums">
            <thead>
              <tr className="border-b border-line">
                <th
                  scope="col"
                  className="py-2 pr-4 font-normal text-ink-muted"
                >
                  {t("weekOf")}
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  {t("activeUsers")}
                </th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.start} className="border-b border-line">
                  <th scope="row" className="py-2 pr-4 font-normal">
                    {w.start}
                  </th>
                  <td className="px-2 py-2">{w.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      </section>

      <section className="mt-12 space-y-3">
        <h2 className="font-display text-h2">{t("byCategoryTitle")}</h2>
        {loops.byCategory.length === 0 ? (
          <p className="text-ink-muted">{t("empty")}</p>
        ) : (
          <ScrollRegion label={t("byCategoryTitle")}>
            <table className="w-full min-w-120 text-left text-supporting tabular-nums">
              <thead>
                <tr className="border-b border-line">
                  <th
                    scope="col"
                    className="py-2 pr-4 font-normal text-ink-muted"
                  >
                    {t("category")}
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    {t("started")}
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    {t("finished")}
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    {t("rate")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loops.byCategory.map((c) => (
                  <tr key={c.category} className="border-b border-line">
                    <th scope="row" className="py-2 pr-4 font-normal">
                      {categoryName(c.category)}
                    </th>
                    <td className="px-2 py-2">{c.started}</td>
                    <td className="px-2 py-2">{c.finished}</td>
                    <td className="px-2 py-2">{percent(c.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        )}
      </section>

      <p className="mt-12 max-w-reading text-supporting text-ink-muted">
        {t("how")}
      </p>
    </main>
  );
}
