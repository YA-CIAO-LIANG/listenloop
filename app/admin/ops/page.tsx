import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import {
  AnnouncementForm,
  EndAnnouncementButton,
  SiteSwitchesForm,
} from "@/components/OpsAdmin";
import {
  activeAnnouncements,
  DEFAULT_SWITCHES,
  parseAnnouncement,
  parseSwitches,
} from "@/lib/site-switches";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.ops");
  return { title: t("title") };
}

/**
 * Operations (D155): the emergency switches and the site's
 * announcements. Read with the secret key, uncached, so the admin sees
 * exactly what's saved.
 */
export default async function AdminOpsPage() {
  const [t, format] = await Promise.all([
    getTranslations("admin.ops"),
    getFormatter(),
  ]);
  const admin = getAdminSupabase();
  const [{ data: settings }, { data: rows }] = admin
    ? await Promise.all([
        admin
          .from("site_settings")
          .select("maintenance, read_only, features")
          .maybeSingle(),
        admin
          .from("site_announcements")
          .select("id, level, body_zh, body_en, starts_at, ends_at")
          .order("starts_at", { ascending: false })
          .limit(20),
      ])
    : [{ data: null }, { data: null }];
  const switches = settings ? parseSwitches(settings) : DEFAULT_SWITCHES;
  const announcements = (rows ?? []).flatMap(
    (row) => parseAnnouncement(row) ?? [],
  );
  const now = new Date();
  const showing = new Set(
    activeAnnouncements(announcements, now).map((a) => a.id),
  );

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <p className="mt-2">
        <Link
          href="/status"
          className="tap text-supporting text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
        >
          {t("statusLink")}
        </Link>
      </p>

      <section aria-labelledby="ops-switches" className="mt-12 max-w-practice">
        <h2 id="ops-switches" className="font-display text-h2">
          {t("switchesTitle")}
        </h2>
        <div className="mt-4">
          <SiteSwitchesForm saved={switches} />
        </div>
      </section>

      <section
        aria-labelledby="ops-announcements"
        className="mt-12 max-w-practice space-y-4"
      >
        <h2 id="ops-announcements" className="font-display text-h2">
          {t("announcementsTitle")}
        </h2>
        <p className="text-supporting text-ink-muted">
          {t("announcementsIntro")}
        </p>
        <AnnouncementForm />
        {announcements.length === 0 ? (
          <p className="text-ink-muted">{t("noAnnouncements")}</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {announcements.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-start justify-between gap-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-metadata text-ink-muted">
                    {t(`levels.${a.level}`)} ·{" "}
                    {format.dateTime(new Date(a.startsAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    · {showing.has(a.id) ? t("active") : t("ended")}
                  </p>
                  <p className="mt-1 text-supporting">{a.bodyZh}</p>
                  <p lang="en" className="mt-1 text-supporting text-ink-muted">
                    {a.bodyEn}
                  </p>
                </div>
                {showing.has(a.id) && <EndAnnouncementButton id={a.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
