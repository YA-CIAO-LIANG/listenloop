import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getBetaStatus } from "@/auth/beta";
import { BetaGuide } from "@/components/BetaGuide";
import { BetaNote } from "@/components/BetaNote";
import { BetaWaitlistForm } from "@/components/BetaWaitlistForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("beta");
  return { title: t("title"), robots: { index: false, follow: true } };
}

const REASONS = ["full", "closed", "invite"] as const;

/**
 * The Beta (D132): why someone couldn't sign up (the places are taken,
 * sign-ups are closed, or an invite link that doesn't work), the testers'
 * guide (D212), and the waiting list. Anyone can open it.
 */
export default async function BetaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const asked = (await searchParams).reason;
  const reason = REASONS.find((r) => r === asked);
  const [t, status] = await Promise.all([
    getTranslations("beta"),
    getBetaStatus(),
  ]);
  const shown = reason ?? (status?.full ? "full" : null);
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">
        {shown === "invite"
          ? t("inviteTitle")
          : shown
            ? t("title")
            : t("openTitle")}
      </h1>
      <p className="mt-4 max-w-reading text-ink-muted">
        {shown ? t(`reasons.${shown}`) : t("open")}
      </p>
      {!shown && (
        <p className="mt-4">
          <Link
            href="/login"
            className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
          >
            {t("signIn")}
          </Link>
        </p>
      )}
      <BetaNote className="mt-6" />
      <BetaGuide />
      <section aria-labelledby="beta-waitlist" className="mt-10 max-w-reading">
        <h2 id="beta-waitlist" className="font-display text-h2">
          {t("waitlist.title")}
        </h2>
        <p className="mt-2 text-supporting text-ink-muted">
          {t("waitlist.intro")}
        </p>
        <div className="mt-6">
          <BetaWaitlistForm />
        </div>
      </section>
    </main>
  );
}
