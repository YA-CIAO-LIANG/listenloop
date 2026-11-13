import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { getBetaStatus, inviteFromCookie } from "@/auth/beta";
import { lineEnabled } from "@/auth/line";
import { BetaNote } from "@/components/BetaNote";
import { getSignedInUser } from "@/auth/session";
import { LoginForm } from "@/components/LoginForm";
import { safeNextPath } from "@/lib/auth/redirect";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title"), robots: { index: false, follow: true } };
}

/** Signing in (D101): Google, LINE, or email and password. */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath((params.next as string | undefined) ?? "/");
  // Signing in again for an admin's risky action (D159): the form shows
  // even when signed in; signing in replaces the session.
  const reauth = params.reauth === "1";
  if (!reauth && (await getSignedInUser())) redirect(next);
  const [t, beta, invite] = await Promise.all([
    getTranslations("login"),
    getBetaStatus(),
    inviteFromCookie(),
  ]);
  const link =
    "text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink";
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      {reauth && (
        <p role="status" className="mt-4 max-w-reading font-medium">
          {t("reauth")}
        </p>
      )}
      {/* Sign-ups in stages (D132): an invite, or a full Beta. */}
      {invite ? (
        <p role="status" className="mt-4 max-w-reading text-success">
          {t("beta.invited")}
        </p>
      ) : (
        beta?.full && (
          <p className="mt-4 max-w-reading text-supporting">
            {t("beta.full")}{" "}
            <Link href="/beta?reason=full" className={link}>
              {t("joinWaitlist")}
            </Link>
          </p>
        )
      )}
      <BetaNote className="mt-4" />
      <div className="mt-8">
        <LoginForm next={next} line={lineEnabled()} />
      </div>
      {/* Agreeing by continuing, with the age rule (terms §2). */}
      <p className="mt-8 max-w-reading text-supporting text-ink-muted">
        {t.rich("consent", {
          terms: (chunks) => (
            <Link href="/terms" className={link}>
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link href="/privacy" className={link}>
              {chunks}
            </Link>
          ),
        })}
      </p>
    </main>
  );
}
