import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { getBetaStatus } from "@/auth/beta";
import {
  InviteCreator,
  RevokeInviteButton,
  SignupSettingsForm,
  WaitlistInviter,
} from "@/components/BetaAdmin";
import { ScrollRegion } from "@/components/ScrollRegion";
import { StatTile } from "@/components/StatTile";
import { ADMIN_PAGE_ROWS } from "@/lib/admin-dashboard";
import { DEFAULT_SIGNUP_CAP, inviteState, inviteUrl } from "@/lib/beta";
import { SITE_URL } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.beta");
  return { title: t("title") };
}

/**
 * Sign-ups in stages (D132): accounts let in against the cap, public
 * sign-ups on or off, invites and how they've been used, and the
 * waiting list to invite from.
 */
export default async function AdminBetaPage() {
  const [t, format, status] = await Promise.all([
    getTranslations("admin.beta"),
    getFormatter(),
    getBetaStatus(),
  ]);
  const admin = getAdminSupabase();
  const [{ data: invites }, { data: waitlist }, { count: waiting }] = admin
    ? await Promise.all([
        admin
          .from("beta_invites")
          .select(
            "id, code, note, max_uses, uses, expires_at, revoked_at, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(ADMIN_PAGE_ROWS),
        admin
          .from("beta_waitlist")
          .select("id, email, purpose, created_at, invited_at")
          .order("invited_at", { ascending: true, nullsFirst: true })
          .order("created_at", { ascending: true })
          .limit(ADMIN_PAGE_ROWS),
        admin
          .from("beta_waitlist")
          .select("id", { count: "exact", head: true })
          .is("invited_at", null),
      ])
    : [{ data: null }, { data: null }, { count: null }];
  const now = new Date();
  const date = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: "medium" });
  const activeInvites = (invites ?? []).filter(
    (invite) => inviteState(invite, now) === "active",
  ).length;

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      {!admin && <p className="mt-4 text-error">{t("noKey")}</p>}

      <dl className="mt-8 grid grid-cols-2 gap-4 wide:grid-cols-4">
        <StatTile
          label={t("admitted")}
          value={`${format.number(status?.admitted ?? 0)} / ${format.number(status?.cap ?? DEFAULT_SIGNUP_CAP)}`}
          note={
            status?.open === false
              ? t("closedNote")
              : status?.full
                ? t("fullNote")
                : t("openNote")
          }
        />
        <StatTile
          label={t("waiting")}
          value={format.number(waiting ?? 0)}
          note={t("waitingNote")}
        />
        <StatTile
          label={t("activeInvites")}
          value={format.number(activeInvites)}
          note={t("activeInvitesNote")}
        />
      </dl>

      <section aria-labelledby="beta-settings" className="mt-12 space-y-3">
        <h2 id="beta-settings" className="font-display text-h2">
          {t("settingsTitle")}
        </h2>
        <p className="max-w-reading text-supporting text-ink-muted">
          {t("settingsIntro")}
        </p>
        <SignupSettingsForm
          open={status?.open ?? true}
          cap={status?.cap ?? DEFAULT_SIGNUP_CAP}
        />
      </section>

      <section aria-labelledby="beta-invites" className="mt-12 space-y-4">
        <h2 id="beta-invites" className="font-display text-h2">
          {t("invitesTitle")}
        </h2>
        <InviteCreator />
        {(invites ?? []).length === 0 ? (
          <p className="text-ink-muted">{t("noInvites")}</p>
        ) : (
          <ScrollRegion label={t("invitesTitle")}>
            <table className="w-full min-w-160 text-left text-supporting tabular-nums">
              <thead>
                <tr className="border-b border-line text-ink-muted">
                  <th scope="col" className="py-2 pr-4 font-normal">
                    {t("columns.code")}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    {t("columns.note")}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    {t("columns.uses")}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    {t("columns.expires")}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    {t("columns.state")}
                  </th>
                  <th scope="col" className="py-2 font-normal">
                    <span className="sr-only">{t("columns.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(invites ?? []).map((invite) => {
                  const state = inviteState(invite, now);
                  return (
                    <tr key={invite.id} className="border-b border-line">
                      <th scope="row" className="py-2 pr-4 font-medium">
                        <span className="font-mono">{invite.code}</span>
                        <span className="block text-metadata font-normal break-all text-ink-muted">
                          {inviteUrl(SITE_URL, invite.code)}
                        </span>
                      </th>
                      <td className="py-2 pr-4 break-all">
                        {invite.note ?? "—"}
                      </td>
                      <td className="py-2 pr-4">
                        {invite.uses} / {invite.max_uses}
                      </td>
                      <td className="py-2 pr-4">
                        {invite.expires_at
                          ? date(invite.expires_at)
                          : t("forever")}
                      </td>
                      <td className="py-2 pr-4">{t(`states.${state}`)}</td>
                      <td className="py-2">
                        {state === "active" && (
                          <RevokeInviteButton
                            id={invite.id}
                            code={invite.code}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollRegion>
        )}
      </section>

      <section aria-labelledby="beta-waitlist" className="mt-12 space-y-3">
        <h2 id="beta-waitlist" className="font-display text-h2">
          {t("waitlistTitle")}
        </h2>
        <p className="max-w-reading text-supporting text-ink-muted">
          {t("waitlistIntro")}
        </p>
        {(waitlist ?? []).length === 0 ? (
          <p className="text-ink-muted">{t("noWaitlist")}</p>
        ) : (
          <WaitlistInviter
            people={(waitlist ?? []).map((row) => ({
              id: row.id,
              email: row.email,
              purpose: row.purpose,
              joined: date(row.created_at),
              invited: row.invited_at ? date(row.invited_at) : null,
            }))}
          />
        )}
      </section>
    </main>
  );
}
