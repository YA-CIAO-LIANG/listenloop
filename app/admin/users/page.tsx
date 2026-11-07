import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { userNumberLabel } from "@/lib/accounts";
import { adminPeriods } from "@/lib/admin-dashboard";
import { microsToUsd } from "@/lib/usage-report";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.users");
  return { title: t("title") };
}

/**
 * Every account (D56), by number: when it signed up, its last activity,
 * practices made, this month's API cost, role, and status. No emails.
 * Each number opens the account's page (role, status, activity).
 */
export default async function AdminUsersPage() {
  const [t, format] = await Promise.all([
    getTranslations("admin.users"),
    getFormatter(),
  ]);
  const admin = getAdminSupabase();
  const { data: users } = admin
    ? await admin.rpc("admin_users", {
        month_start: adminPeriods(new Date()).monthStart,
      })
    : { data: null };
  const date = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: "medium" }) : "—";

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      {!users?.length ? (
        <p className="mt-8 text-ink-muted">{t("none")}</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-y border-line text-supporting">
            <thead className="text-left text-ink-muted">
              <tr className="border-b border-line">
                {(
                  [
                    "number",
                    "joined",
                    "lastSeen",
                    "practices",
                    "cost",
                    "role",
                    "status",
                  ] as const
                ).map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="py-2 pr-4 font-normal"
                  >
                    {t(`columns.${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {users.map((user) => (
                <tr key={user.user_id}>
                  <td className="py-2 pr-4">
                    <Link
                      href={`/admin/users/${user.number}`}
                      className="text-accent-ink underline underline-offset-4"
                    >
                      {t("userName", { number: userNumberLabel(user.number) })}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {date(user.created_at)}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {date(user.last_seen_at)}
                  </td>
                  <td className="py-2 pr-4">{format.number(user.practices)}</td>
                  <td className="py-2 pr-4">
                    {format.number(microsToUsd(user.month_micros), {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 4,
                    })}
                  </td>
                  <td className="py-2 pr-4">
                    {t(`roles.${user.role === "admin" ? "admin" : "user"}`)}
                  </td>
                  <td
                    className={`py-2 ${user.status === "disabled" ? "text-error" : ""}`}
                  >
                    {t(
                      `statuses.${user.status === "disabled" ? "disabled" : "active"}`,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
