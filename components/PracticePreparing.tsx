import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { PracticeState } from "@/auth/practice-material";
import { PracticeReadiness } from "./PracticeReadiness";

type PracticePreparingProps = {
  practice: Extract<PracticeState, { status: "preparing" }>;
  /** The page that was asked for; it opens once everything is ready. */
  practiceHref: string;
};

/**
 * Shown instead of a practice page (overview, a day, the handout) while
 * the viewer's own created practice still lacks its notes or audio: what's
 * missing and a button to finish it here (D32). Once ready, the page
 * refreshes into the practice itself.
 */
export async function PracticePreparing({
  practice,
  practiceHref,
}: PracticePreparingProps) {
  const t = await getTranslations("create");
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <Link
        href="/materials"
        className="text-supporting text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">← </span>
        {t("notReadyBack")}
      </Link>
      <h1 className="mt-8 font-display text-h1">{practice.title}</h1>
      <h2 className="mt-8 font-display text-h3">{t("notReadyTitle")}</h2>
      <p className="mt-2 text-ink-muted">{t("notReadyIntro")}</p>
      <div className="mt-6">
        <PracticeReadiness
          practiceId={practice.practiceId}
          practiceHref={practiceHref}
          {...practice.readiness}
        />
      </div>
    </main>
  );
}
