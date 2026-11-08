import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getSignedInUser } from "@/auth/session";
import { ButtonLink } from "@/components/ButtonLink";
import { JoinClassForm } from "@/components/ClassroomForms";
import { isInviteCode } from "@/lib/classroom";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("classroom");
  return { title: t("joinTitle"), robots: { index: false, follow: false } };
}

/** The invite link a teacher shares (D103): sign in, then join. */
export default async function JoinPage({
  params,
}: PageProps<"/classroom/join/[code]">) {
  const { code } = await params;
  const [t, user] = await Promise.all([
    getTranslations("classroom"),
    getSignedInUser(),
  ]);
  const valid = isInviteCode(code) ? code.toUpperCase() : "";
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("joinTitle")}</h1>
      <div className="mt-8">
        {user ? (
          <JoinClassForm code={valid} />
        ) : (
          <div className="space-y-4">
            <p className="text-ink-muted">{t("signInToJoin")}</p>
            <ButtonLink
              href={`/login?next=${encodeURIComponent(`/classroom/join/${valid}`)}`}
              variant="primary"
              arrow
            >
              {t("signIn")}
            </ButtonLink>
          </div>
        )}
      </div>
    </main>
  );
}
