import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { Button } from "@/components/Button";
import { EventTable } from "@/components/EventTable";
import { ADMIN_PAGE_ROWS } from "@/lib/admin-dashboard";
import { isLocalDate } from "@/lib/dates";
import { EVENT_TYPES, isEventType } from "@/lib/events";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.events");
  return { title: t("title") };
}

const fieldClass =
  "block w-full rounded-base border border-line bg-surface px-3 py-2 text-supporting focus-visible:border-accent pointer-coarse:min-h-11";

/**
 * The activity log (D55, D56), newest first, filtered by account number,
 * event type, and dates (Taiwan time). The filters are a plain GET form,
 * so a filtered view can be bookmarked or shared with another admin.
 */
export default async function AdminEventsPage({
  searchParams,
}: PageProps<"/admin/events">) {
  const query = await searchParams;
  const one = (key: string) => {
    const value = query[key];
    return typeof value === "string" ? value.trim() : "";
  };
  const user = /^\d{1,9}$/.test(one("user")) ? one("user") : "";
  const type = isEventType(one("type")) ? one("type") : "";
  const from = isLocalDate(one("from")) ? one("from") : "";
  const to = isLocalDate(one("to")) ? one("to") : "";
  const [t, tTypes] = await Promise.all([
    getTranslations("admin.events"),
    getTranslations("events.types"),
  ]);
  const admin = getAdminSupabase();

  let events = null;
  const numbers = new Map<string, number>();
  if (admin) {
    let userId: string | null = null;
    if (user) {
      const { data } = await admin
        .from("profiles")
        .select("user_id")
        .eq("number", Number(user))
        .maybeSingle();
      userId = data?.user_id ?? "00000000-0000-0000-0000-000000000000";
    }
    let request = admin
      .from("events")
      .select("id, created_at, user_id, type, video_id, day, score, code")
      .order("created_at", { ascending: false })
      .limit(ADMIN_PAGE_ROWS);
    if (userId) request = request.eq("user_id", userId);
    if (type) request = request.eq("type", type);
    if (from) request = request.gte("created_at", `${from}T00:00:00+08:00`);
    if (to) request = request.lte("created_at", `${to}T23:59:59.999+08:00`);
    const { data } = await request;
    events = data ?? [];
    const ids = [
      ...new Set(events.flatMap((e) => (e.user_id ? [e.user_id] : []))),
    ];
    if (ids.length) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("user_id, number")
        .in("user_id", ids);
      for (const p of profiles ?? []) numbers.set(p.user_id, p.number);
    }
  }

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <form
        method="get"
        className="mt-8 grid gap-4 split:grid-cols-2 wide:grid-cols-5 wide:items-end"
      >
        <label className="space-y-1 text-supporting">
          <span>{t("filters.user")}</span>
          <input
            name="user"
            inputMode="numeric"
            defaultValue={user}
            placeholder="001"
            className={fieldClass}
          />
        </label>
        <label className="space-y-1 text-supporting">
          <span>{t("filters.type")}</span>
          <select name="type" defaultValue={type} className={fieldClass}>
            <option value="">{t("filters.allTypes")}</option>
            {EVENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {tTypes(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-supporting">
          <span>{t("filters.from")}</span>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className={fieldClass}
          />
        </label>
        <label className="space-y-1 text-supporting">
          <span>{t("filters.to")}</span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className={fieldClass}
          />
        </label>
        <div>
          <Button type="submit" variant="secondary">
            {t("filters.apply")}
          </Button>
        </div>
      </form>
      <p className="mt-6 text-supporting text-ink-muted">
        {t("shown", { max: ADMIN_PAGE_ROWS })}
      </p>
      {events && <EventTable events={events} numbers={numbers} />}
    </main>
  );
}
