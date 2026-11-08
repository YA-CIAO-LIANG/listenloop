import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { lineEnabled } from "@/auth/line";
import { getSignedInUser } from "@/auth/session";
import { LoginForm } from "@/components/LoginForm";
import { safeNextPath } from "@/lib/auth/redirect";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title"), robots: { index: false, follow: true } };
}

/** Signing in (D101): Google, LINE, or email and password. */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNextPath(
    ((await searchParams).next as string | undefined) ?? "/",
  );
  if (await getSignedInUser()) redirect(next);
  const t = await getTranslations("login");
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <div className="mt-8">
        <LoginForm next={next} line={lineEnabled()} />
      </div>
    </main>
  );
}
