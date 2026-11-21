import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getSignedInUser } from "@/auth/session";
import { ChatPractice } from "@/components/writing/chat/ChatPractice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("writingChat");
  return {
    title: t("title"),
    description: t("intro"),
    robots: { index: false, follow: false },
  };
}

/** Chat practice (D197): a timed, quietly corrected text conversation. */
export default async function WritingChatPage() {
  const [t, user] = await Promise.all([
    getTranslations("writingChat"),
    getSignedInUser(),
  ]);
  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-4 py-6 split:px-6 split:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-h2 split:text-h1">{t("title")}</h1>
        <p className="max-w-reading text-ink-muted">{t("intro")}</p>
      </header>
      <ChatPractice signedIn={user !== null} />
    </main>
  );
}
