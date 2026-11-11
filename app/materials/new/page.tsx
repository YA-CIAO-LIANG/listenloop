import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { creationAllowed } from "@/auth/creation-quota";
import { getCreator } from "@/auth/creator";
import { onWaitlist } from "@/app/plans/actions";
import { CreatePracticeForm } from "@/components/CreatePracticeForm";
import { youtubeEnabled } from "@/auth/youtube";
import { YOUTUBE_LINK_PRACTICES_ENABLED } from "@/lib/features";
import { PaidPlanCard } from "@/components/PaidPlanCard";

/**
 * The server actions on this page call the AI providers: up to 60 s
 * (Vercel Hobby's limit), longer than any provider timeout, so a slow call
 * ends in a logged timeout, never a cut-off function (D49).
 */
export const maxDuration = 60;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("create");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Creating a practice from uploaded text (roadmap d): signed-in accounts
 * whose plan allows it, with a provider; 404 for everyone else. Past the
 * plan's limit (the free trial, D72), the paid plan and its waiting list
 * show instead of the form.
 */
export default async function NewMaterialPage({
  searchParams,
}: PageProps<"/materials/new">) {
  const creator = await getCreator();
  if (!creator) notFound();
  // ?official=1: an admin making an official material (D80).
  const official =
    (await searchParams).official === "1" && creator.user.role === "admin";
  const allowed = await creationAllowed(creator);
  const joined = allowed.ok ? false : await onWaitlist();
  const [t, tMaterials] = await Promise.all([
    getTranslations("create"),
    getTranslations("materials"),
  ]);

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <Link
        href={official ? "/admin/official" : "/materials"}
        className="tap text-supporting text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">← </span>
        {official ? t("officialBack") : tMaterials("title")}
      </Link>
      <h1 className="mt-6 font-display text-h1">
        {official ? t("officialTitle") : t("title")}
      </h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <p className="mt-4 max-w-reading text-supporting text-ink-muted">
        {t.rich("privacyNote", {
          link: (chunks) => (
            <Link
              href="/privacy"
              className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>
      <div className="mt-12 max-w-practice">
        {allowed.ok ? (
          <CreatePracticeForm
            official={official}
            // Speech to text set up (D130); the plan is checked inside.
            upload={!official && !!creator.providers.transcribe}
            youtube={
              // Paused (D131): not even admins see it.
              official || !YOUTUBE_LINK_PRACTICES_ENABLED
                ? false
                : youtubeEnabled()
                  ? true
                  : // Admins see where it would be and how to set it up (D129).
                    creator.user.role === "admin" && "no-key"
            }
          />
        ) : (
          <PaidPlanCard
            block={{ limit: allowed.limit, max: allowed.max }}
            joined={joined}
          />
        )}
      </div>
    </main>
  );
}
