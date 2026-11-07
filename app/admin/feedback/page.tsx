import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { FeedbackStatusButton } from "@/components/FeedbackStatusButton";
import { userNumberLabel } from "@/lib/accounts";
import { ADMIN_PAGE_ROWS } from "@/lib/admin-dashboard";
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from "@/lib/feedback";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.feedback");
  return { title: t("title") };
}

/** Feedback from the footer's form (D60), open first, newest first. */
export default async function AdminFeedbackPage() {
  const [t, tCategories, format] = await Promise.all([
    getTranslations("admin.feedback"),
    getTranslations("feedback.categories"),
    getFormatter(),
  ]);
  const admin = getAdminSupabase();
  const { data: rows } = admin
    ? await admin
        .from("feedback")
        .select("id, created_at, user_id, category, message, page, status")
        .order("status", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(ADMIN_PAGE_ROWS)
    : { data: null };
  const ids = [
    ...new Set((rows ?? []).flatMap((r) => (r.user_id ? [r.user_id] : []))),
  ];
  const { data: profiles } =
    admin && ids.length
      ? await admin
          .from("profiles")
          .select("user_id, number")
          .in("user_id", ids)
      : { data: null };
  const numbers = new Map((profiles ?? []).map((p) => [p.user_id, p.number]));
  const category = (value: string) =>
    (FEEDBACK_CATEGORIES as readonly string[]).includes(value)
      ? tCategories(value as FeedbackCategory)
      : value;

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      {!rows?.length ? (
        <p className="mt-8 text-ink-muted">{t("none")}</p>
      ) : (
        <ul className="mt-8 max-w-practice divide-y divide-line border-y border-line">
          {rows.map((row) => {
            const number = row.user_id ? numbers.get(row.user_id) : undefined;
            return (
              <li key={row.id} className="space-y-2 py-4">
                <p className="text-supporting text-ink-muted">
                  {[
                    format.dateTime(new Date(row.created_at), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                    category(row.category),
                    number !== undefined
                      ? t("from", { number: userNumberLabel(number) })
                      : t("anonymous"),
                    row.status === "done" ? t("done") : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="whitespace-pre-wrap">{row.message}</p>
                {row.page && (
                  <p className="text-supporting">
                    <Link
                      href={row.page}
                      className="text-accent-ink underline underline-offset-4"
                    >
                      {row.page}
                    </Link>
                  </p>
                )}
                <FeedbackStatusButton
                  id={row.id}
                  status={row.status === "done" ? "done" : "open"}
                />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
