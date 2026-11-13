import { getTranslations } from "next-intl/server";
import { getSignedInUser } from "@/auth/session";

/**
 * Who ListenLoop is for and how, readable in five seconds (D119), for a
 * signed-out visitor only: signed in, it's left out so today's tasks come
 * up higher (D170). Decided on the server, so nothing shifts.
 */
export async function HomeVisitorIntro() {
  const [user, t] = await Promise.all([
    getSignedInUser(),
    getTranslations("home"),
  ]);
  if (user) return null;
  return <p className="mt-3 max-w-reading text-ink-muted">{t("audience")}</p>;
}
