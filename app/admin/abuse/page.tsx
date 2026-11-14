import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { AbuseControls } from "@/components/AbuseControls";
import { userNumberLabel } from "@/lib/accounts";
import { ABUSE } from "@/lib/ops/abuse";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.abuse");
  return { title: t("title") };
}

const KINDS = [
  "multi-signup",
  "heavy-use",
  "capped-days",
  "reported",
  "referral-farm",
] as const;
type Kind = (typeof KINDS)[number];
const isKind = (value: string): value is Kind =>
  (KINDS as readonly string[]).includes(value);

/**
 * Abuse flags (D162): what the detector found, open ones first, with
 * the account and what triggered it; confirm or dismiss each.
 */
export default async function AdminAbusePage() {
  const [t, format] = await Promise.all([
    getTranslations("admin.abuse"),
    getFormatter(),
  ]);
  const admin = getAdminSupabase();
  const { data: flags } = admin
    ? await admin
        .from("abuse_flags")
        .select(
          "id, user_id, kind, detail, auto_suspended, status, note, created_at",
        )
        .order("status", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: null };
  const rows = flags ?? [];
  const { data: profiles } =
    admin && rows.length
      ? await admin
          .from("profiles")
          .select("user_id, number")
          .in(
            "user_id",
            rows.map((r) => r.user_id),
          )
      : { data: [] };
  const numberOf = new Map((profiles ?? []).map((p) => [p.user_id, p.number]));

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">
        {t("intro", {
          ip: ABUSE.signupsPerIp,
          calls: ABUSE.heavyCallsPerHour,
          days: ABUSE.cappedDays,
          reporters: ABUSE.reporters,
        })}
      </p>
      {rows.length === 0 ? (
        <p className="mt-8 text-ink-muted">{t("none")}</p>
      ) : (
        <ul className="mt-8 max-w-practice divide-y divide-line border-y border-line">
          {rows.map((flag) => {
            const number = numberOf.get(flag.user_id) ?? null;
            return (
              <li key={flag.id} className="space-y-2 py-4">
                <p className="text-metadata text-ink-muted">
                  {format.dateTime(new Date(flag.created_at), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  ·{" "}
                  {t(
                    `status.${flag.status as "open" | "confirmed" | "dismissed"}`,
                  )}
                  {flag.auto_suspended && ` · ${t("autoSuspended")}`}
                </p>
                <p>
                  {number !== null ? (
                    <Link
                      href={`/admin/users/${number}`}
                      className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
                    >
                      {t("user", { number: userNumberLabel(number) })}
                    </Link>
                  ) : (
                    "—"
                  )}{" "}
                  · {isKind(flag.kind) ? t(`kinds.${flag.kind}`) : flag.kind}
                </p>
                <p className="text-supporting text-ink-muted">
                  {Object.entries(
                    (flag.detail ?? {}) as Record<string, unknown>,
                  )
                    .map(([key, value]) => `${key}: ${String(value)}`)
                    .join(" · ")}
                  {flag.note && ` · ${flag.note}`}
                </p>
                {flag.status === "open" && <AbuseControls id={flag.id} />}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
