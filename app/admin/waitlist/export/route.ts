import { getAdminSupabase } from "@/auth/admin";
import { getAdminUser } from "@/auth/creator";
import { userNumberLabel } from "@/lib/accounts";

/** A CSV cell: quoted when it holds a comma, quote, or line break. */
const cell = (value: string) =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/**
 * The paid plan's waiting list as CSV (D85), for telling them when it
 * opens: account number, email, and when they joined. Admins only (404
 * otherwise, like every admin page).
 */
export async function GET() {
  const [user, admin] = [await getAdminUser(), getAdminSupabase()];
  if (!user || !admin) return new Response("Not found", { status: 404 });
  const { data: rows } = await admin
    .from("waitlist")
    .select("user_id, created_at")
    .order("created_at", { ascending: true })
    .limit(5000);
  const list = rows ?? [];
  const { data: profiles } = list.length
    ? await admin
        .from("profiles")
        .select("user_id, number")
        .in(
          "user_id",
          list.map((r) => r.user_id),
        )
    : { data: [] };
  const numbers = new Map((profiles ?? []).map((p) => [p.user_id, p.number]));
  const emails = new Map<string, string>();
  for (const row of list) {
    const { data } = await admin.auth.admin.getUserById(row.user_id);
    if (data.user?.email) emails.set(row.user_id, data.user.email);
  }
  const lines = [
    "account,email,joined_at",
    ...list.map((row) =>
      [
        userNumberLabel(numbers.get(row.user_id) ?? null),
        emails.get(row.user_id) ?? "",
        row.created_at,
      ]
        .map(cell)
        .join(","),
    ),
  ];
  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="listenloop-waitlist.csv"',
      "cache-control": "no-store",
    },
  });
}
