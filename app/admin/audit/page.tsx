import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { userNumberLabel } from "@/lib/accounts";
import { ADMIN_PAGE_ROWS } from "@/lib/admin-dashboard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.audit");
  return { title: t("title") };
}

/**
 * Every admin change (D56), newest first: who (account number), when,
 * the action, its target, and what changed (before → after).
 */
export default async function AdminAuditPage() {
  const [t, format] = await Promise.all([
    getTranslations("admin.audit"),
    getFormatter(),
  ]);
  const admin = getAdminSupabase();
  const { data: rows } = admin
    ? await admin
        .from("admin_audit")
        .select(
          "id, created_at, admin_id, action, target_type, target_id, changes",
        )
        .order("created_at", { ascending: false })
        .limit(ADMIN_PAGE_ROWS)
    : { data: null };
  const ids = [
    ...new Set((rows ?? []).flatMap((r) => (r.admin_id ? [r.admin_id] : []))),
  ];
  const { data: profiles } =
    admin && ids.length
      ? await admin
          .from("profiles")
          .select("user_id, number")
          .in("user_id", ids)
      : { data: null };
  const numbers = new Map((profiles ?? []).map((p) => [p.user_id, p.number]));
  const describe = (changes: unknown) => {
    if (typeof changes !== "object" || changes === null) return "—";
    const c = changes as Record<string, unknown>;
    if ("from" in c || "to" in c)
      return `${String(c.from ?? "—")} → ${String(c.to ?? "—")}`;
    const text = JSON.stringify(c);
    return text === "{}" ? "—" : text;
  };

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      {!rows?.length ? (
        <p className="mt-8 text-ink-muted">{t("none")}</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-y border-line text-supporting">
            <thead className="text-left text-ink-muted">
              <tr className="border-b border-line">
                {(
                  ["time", "admin", "action", "target", "changes"] as const
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
            <tbody className="divide-y divide-line">
              {rows.map((row) => {
                const number = row.admin_id
                  ? numbers.get(row.admin_id)
                  : undefined;
                return (
                  <tr key={row.id}>
                    <td className="py-2 pr-4 whitespace-nowrap tabular-nums">
                      {format.dateTime(new Date(row.created_at), {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {number !== undefined ? userNumberLabel(number) : "—"}
                    </td>
                    <td className="py-2 pr-4">{row.action}</td>
                    <td className="py-2 pr-4 break-all">
                      {row.target_type}: {row.target_id}
                    </td>
                    <td className="py-2 break-all">{describe(row.changes)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
