import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { getActiveAnnouncements, getSiteSwitches } from "@/auth/site-switches";
import { Card } from "@/components/Card";
import { pausedFeatures, siteState } from "@/lib/site-switches";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ops.status");
  return { title: t("title"), description: t("intro") };
}

/**
 * The public status page (D155): the site's state from the emergency
 * switches, what's paused, and the admins' announcements. Open in
 * maintenance mode too.
 */
export default async function StatusPage() {
  const [t, format, locale, switches, announcements] = await Promise.all([
    getTranslations("ops.status"),
    getFormatter(),
    getLocale(),
    getSiteSwitches(),
    getActiveAnnouncements(),
  ]);
  const state = siteState(switches);
  const paused = pausedFeatures(switches);
  const healthy = state === "normal";

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <Card className="mt-8 max-w-practice">
        <p
          role="status"
          className={`flex items-center gap-3 font-medium ${healthy ? "text-success" : "text-error"}`}
        >
          <span
            aria-hidden="true"
            className={`inline-block size-3 rounded-full ${healthy ? "bg-success" : "bg-error"}`}
          />
          {t(`states.${state}`)}
        </p>
        <h2 className="mt-6 font-medium">{t("paused")}</h2>
        {paused.length === 0 ? (
          <p className="mt-2 text-supporting text-ink-muted">{t("none")}</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-6 text-supporting">
            {paused.map((feature) => (
              <li key={feature}>{t(`features.${feature}`)}</li>
            ))}
          </ul>
        )}
      </Card>
      <section className="mt-12 max-w-practice">
        <h2 className="font-display text-h2">{t("announcements")}</h2>
        {announcements.length === 0 ? (
          <p className="mt-4 text-ink-muted">{t("noAnnouncements")}</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {announcements.map((a) => (
              <li key={a.id}>
                <Card>
                  <p className="text-metadata text-ink-muted">
                    {t(`levels.${a.level}`)} ·{" "}
                    {format.dateTime(new Date(a.startsAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  <p className="mt-2 whitespace-pre-line">
                    {locale === "en" ? a.bodyEn : a.bodyZh}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
