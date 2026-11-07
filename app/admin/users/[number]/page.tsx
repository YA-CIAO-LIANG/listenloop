import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { getAdminUser } from "@/auth/creator";
import { EventTable } from "@/components/EventTable";
import { UserControls } from "@/components/UserControls";
import { isAccountStatus, isRole, userNumberLabel } from "@/lib/accounts";
import { isAccountPlan } from "@/lib/plans";
import { ADMIN_PAGE_ROWS } from "@/lib/admin-dashboard";

export async function generateMetadata({
  params,
}: PageProps<"/admin/users/[number]">): Promise<Metadata> {
  const t = await getTranslations("admin.users");
  const { number } = await params;
  return { title: t("userName", { number: userNumberLabel(Number(number)) }) };
}

/**
 * One account (D56): its number, dates, role and status (changeable,
 * except for your own account), and its recent activity.
 */
export default async function AdminUserPage({
  params,
}: PageProps<"/admin/users/[number]">) {
  const { number: raw } = await params;
  const number = Number(raw);
  const admin = getAdminSupabase();
  if (!admin || !/^\d{1,9}$/.test(raw)) notFound();
  const [t, format, actor] = await Promise.all([
    getTranslations("admin.users"),
    getFormatter(),
    getAdminUser(),
  ]);
  const { data: profile } = await admin
    .from("profiles")
    .select("user_id, number, role, status, plan, created_at, last_seen_at")
    .eq("number", number)
    .maybeSingle();
  if (!profile) notFound();
  const { data: events } = await admin
    .from("events")
    .select("id, created_at, user_id, type, video_id, day, score, code")
    .eq("user_id", profile.user_id)
    .order("created_at", { ascending: false })
    .limit(ADMIN_PAGE_ROWS);
  const date = (iso: string | null) =>
    iso
      ? format.dateTime(new Date(iso), {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <Link
        href="/admin/users"
        className="text-supporting text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">← </span>
        {t("title")}
      </Link>
      <h1 className="mt-6 font-display text-h1">
        {t("userName", { number: userNumberLabel(profile.number) })}
      </h1>
      <dl className="mt-6 grid max-w-reading grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-supporting">
        <dt className="text-ink-muted">{t("columns.joined")}</dt>
        <dd>{date(profile.created_at)}</dd>
        <dt className="text-ink-muted">{t("columns.lastSeen")}</dt>
        <dd>{date(profile.last_seen_at)}</dd>
      </dl>
      <section className="mt-8 max-w-reading">
        <UserControls
          user={{
            id: profile.user_id,
            role: isRole(profile.role) ? profile.role : "user",
            status: isAccountStatus(profile.status) ? profile.status : "active",
            plan: isAccountPlan(profile.plan) ? profile.plan : "free",
          }}
          self={actor?.id === profile.user_id}
        />
      </section>
      <section className="mt-12">
        <h2 className="font-display text-h2">{t("activity")}</h2>
        <EventTable
          events={events ?? []}
          numbers={new Map([[profile.user_id, profile.number]])}
        />
      </section>
    </main>
  );
}
