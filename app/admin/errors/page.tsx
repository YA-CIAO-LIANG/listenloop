import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { ADMIN_PAGE_ROWS } from "@/lib/admin-dashboard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.errors");
  return { title: t("title") };
}

/**
 * Recent server errors (D63), newest first: when, where, the message,
 * and the digest the error page shows, so a learner's report can be
 * matched. The stack folds open.
 */
export default async function AdminErrorsPage() {
  const [t, format] = await Promise.all([
    getTranslations("admin.errors"),
    getFormatter(),
  ]);
  const admin = getAdminSupabase();
  const { data: rows } = admin
    ? await admin
        .from("error_logs")
        .select(
          "id, created_at, digest, message, path, method, route_type, stack",
        )
        .order("created_at", { ascending: false })
        .limit(ADMIN_PAGE_ROWS)
    : { data: null };

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      {!rows?.length ? (
        <p className="mt-8 text-ink-muted">{t("none")}</p>
      ) : (
        <ul className="mt-8 max-w-practice divide-y divide-line border-y border-line">
          {rows.map((row) => (
            <li key={row.id} className="space-y-2 py-4">
              <p className="text-supporting text-ink-muted tabular-nums">
                {[
                  format.dateTime(new Date(row.created_at), {
                    dateStyle: "short",
                    timeStyle: "medium",
                  }),
                  [row.method, row.path].filter(Boolean).join(" "),
                  row.route_type,
                  row.digest ? t("digest", { digest: row.digest }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="break-words text-error">{row.message}</p>
              {row.stack && (
                <details className="text-supporting text-ink-muted">
                  <summary className="cursor-pointer">{t("stack")}</summary>
                  <pre className="mt-2 overflow-x-auto break-words whitespace-pre-wrap">
                    {row.stack}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
