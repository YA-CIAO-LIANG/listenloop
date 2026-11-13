import { getTranslations } from "next-intl/server";
import { getOfficialPractices } from "@/auth/library";
import { getSignedInUser } from "@/auth/session";
import { getVideosByCollection } from "@/lib/video-library";
import { ButtonLink } from "./ButtonLink";

/**
 * The shortest way in for a first-time visitor (D169): straight to the
 * first sentence of an easy material's Day 1, no account needed, with
 * the level test as the other way in. Signed-in learners get today's
 * tasks below instead. Decided on the server, in the first HTML, so the
 * top of the page doesn't shift.
 */
export async function QuickStart() {
  const user = await getSignedInUser();
  if (user) return null;
  const [t, official] = await Promise.all([
    getTranslations("home.quickStart"),
    getOfficialPractices().catch(() => []),
  ]);
  const videos = getVideosByCollection().flatMap(({ videos }) => videos);
  const start =
    (official.find((p) => p.level === "beginner") ?? official[0])?.id ??
    (videos.find((v) => v.level === "beginner") ?? videos[0])?.id;
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      {start && (
        <ButtonLink
          href={`/videos/${start}/day/1`}
          variant="primary"
          size="lg"
          arrow
        >
          {t("start")}
        </ButtonLink>
      )}
      <ButtonLink href="/level-test" variant="secondary" size="lg">
        {t("levelTest")}
      </ButtonLink>
      <p className="w-full text-supporting text-ink-muted">{t("note")}</p>
    </div>
  );
}
