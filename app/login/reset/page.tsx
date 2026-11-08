import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getSignedInUser } from "@/auth/session";
import { ButtonLink } from "@/components/ButtonLink";
import { NewPasswordForm } from "@/components/NewPasswordForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("resetTitle"), robots: { index: false, follow: false } };
}

/** After a reset link (D101): signed in by the link, set a new password. */
export default async function ResetPage() {
  const t = await getTranslations("login");
  const user = await getSignedInUser();
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("resetTitle")}</h1>
      {user ? (
        <div className="mt-8 max-w-md">
          <NewPasswordForm email={user.email} />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-ink-muted">{t("resetExpired")}</p>
          <ButtonLink href="/login" variant="primary" arrow>
            {t("title")}
          </ButtonLink>
        </div>
      )}
    </main>
  );
}
