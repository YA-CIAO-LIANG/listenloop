import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSignedInUser } from "@/auth/session";
import { getOwnBilling } from "@/auth/billing";
import { getPaymentProvider } from "@/auth/payments";
import { BackgroundPicker } from "@/components/BackgroundPicker";
import { HandsFreeSetting } from "@/components/HandsFreeSetting";
import { BillingSection } from "@/components/BillingSection";
import { DeleteAccount } from "@/components/DeleteAccount";
import { ReminderSettings } from "@/components/ReminderSettings";
import { accountsEnabled } from "@/lib/supabase/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accountPage");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Web push's public key (D111); reminders are off without it. */
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";

const linkClassName =
  "text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink";

/**
 * The signed-in account: who it is, and deleting it. Signed out, says
 * how to sign in (or, right after a deletion, that it's done).
 */
export default async function AccountPage({
  searchParams,
}: PageProps<"/account">) {
  if (!accountsEnabled) notFound();
  const [t, tHands, user, { deleted }] = await Promise.all([
    getTranslations("accountPage"),
    getTranslations("handsFree"),
    getSignedInUser(),
    searchParams,
  ]);
  const billing = user
    ? await getOwnBilling(user.id)
    : { subscription: null, payments: [] };

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      {user ? (
        <>
          <section className="mt-8 max-w-reading">
            <p className="text-supporting text-ink-muted">{t("signedInAs")}</p>
            <p className="mt-1 break-all">{user.email}</p>
            <p className="mt-4 text-supporting text-ink-muted">
              {t("syncNote")}
            </p>
            {/* Each allowance and when it resets (D161). */}
            <p className="mt-4">
              <Link
                href="/account/usage"
                className="tap text-supporting text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
              >
                {t("quotaLink")}
              </Link>
            </p>
          </section>
          <BillingSection
            plan={user.plan}
            subscription={billing.subscription}
            payments={billing.payments}
            canManage={getPaymentProvider() !== null}
          />
          <BackgroundPicker />
          <section className="mt-16 max-w-reading border-t border-line pt-8">
            <h2 className="font-display text-h2">{tHands("settingsTitle")}</h2>
            <div className="mt-4">
              <HandsFreeSetting />
            </div>
          </section>
          {/* Reminders need the push keys (D111); hidden until they're set. */}
          {VAPID_PUBLIC_KEY && (
            <ReminderSettings publicKey={VAPID_PUBLIC_KEY} />
          )}
          <section className="mt-16 max-w-reading border-t border-line pt-8">
            <h2 className="font-display text-h2">{t("export.title")}</h2>
            <p className="mt-4 text-ink-muted">{t("export.intro")}</p>
            <p className="mt-6">
              <a
                href="/account/export"
                download
                className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
              >
                {t("export.link")}
              </a>
            </p>
          </section>
          <section className="mt-16 max-w-reading border-t border-line pt-8">
            <h2 className="font-display text-h2">{t("delete.title")}</h2>
            <p className="mt-4 text-ink-muted">{t("delete.intro")}</p>
            <div className="mt-6">
              <DeleteAccount />
            </div>
          </section>
        </>
      ) : (
        <div className="mt-8 max-w-reading space-y-4">
          {deleted === "1" ? (
            <p role="status" className="text-success">
              {t("deleted")}
            </p>
          ) : (
            <p className="text-ink-muted">{t("signedOut")}</p>
          )}
          <Link href="/" className={linkClassName}>
            {t("home")} →
          </Link>
        </div>
      )}
      <p className="mt-16 text-supporting text-ink-muted">
        <Link href="/privacy" className={linkClassName}>
          {t("privacy")}
        </Link>
        {" · "}
        <Link href="/terms" className={linkClassName}>
          {t("terms")}
        </Link>
      </p>
    </main>
  );
}
