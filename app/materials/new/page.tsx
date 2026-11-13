import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { creationAllowance } from "@/auth/creation-quota";
import { getGenerationPace } from "@/auth/generation-pace";
import { onWaitlist } from "@/app/plans/actions";
import { CreatePracticeForm } from "@/components/CreatePracticeForm";
import { youtubeEnabled } from "@/auth/youtube";
import { YOUTUBE_LINK_PRACTICES_ENABLED } from "@/lib/features";
import { PaidPlanCard } from "@/components/PaidPlanCard";
import { WeekAllowanceNote } from "@/components/WeekAllowanceNote";
import { ButtonLink } from "@/components/ButtonLink";
import { featurePaused } from "@/auth/site-switches";
import { getSignedInUser } from "@/auth/session";
import { canCreatePractices, getCreator } from "@/auth/creator";

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
  if (!creator) {
    // Paused by an emergency switch (D155): say so instead of a 404.
    const user = await getSignedInUser();
    if (canCreatePractices(user) && (await featurePaused(user, "create"))) {
      return <CreationPaused />;
    }
    // AI paused for this account (D161): say so, and how to ask.
    if (canCreatePractices(user) && user.aiSuspended != null) {
      return <CreationPaused account />;
    }
    notFound();
  }
  // ?official=1: an admin making an official material (D80).
  const official =
    (await searchParams).official === "1" && creator.user.role === "admin";
  const { check: allowed, week } = await creationAllowance(creator);
  const joined = allowed.ok ? false : await onWaitlist();
  const [aiGenerate, aiRevise, uploadOff, transcribeOff] = await Promise.all([
    featurePaused(creator.user, "aiGenerate"),
    featurePaused(creator.user, "aiRevise"),
    featurePaused(creator.user, "uploadAudio"),
    featurePaused(creator.user, "transcribe"),
  ]);
  const [t, tMaterials, tStatus] = await Promise.all([
    getTranslations("create"),
    getTranslations("materials"),
    getTranslations("ops.status"),
  ]);
  const pausedNames = (
    [
      ["aiGenerate", aiGenerate],
      ["aiRevise", aiRevise],
      ["uploadAudio", uploadOff],
      ["transcribe", transcribeOff],
    ] as const
  )
    .filter(([, paused]) => paused !== null)
    .map(([feature]) => tStatus(`features.${feature}`));

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
      <div className="mt-12 max-w-practice space-y-6">
        {/* The free plan's minutes this week (D143). */}
        {week && !official && <WeekAllowanceNote week={week} />}
        {/* Features paused by an emergency switch (D155). */}
        {pausedNames.length > 0 && (
          <p role="note" className="text-supporting text-ink-muted">
            {t("paused.some", {
              features: pausedNames.join(t("listSeparator")),
            })}{" "}
            <Link
              href="/status"
              className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
            >
              {t("paused.status")}
            </Link>
          </p>
        )}
        {allowed.ok ? (
          <CreatePracticeForm
            official={official}
            sitePace={await getGenerationPace()}
            // Speech to text set up (D130); the plan is checked inside.
            upload={
              !official &&
              !!creator.providers.transcribe &&
              !uploadOff &&
              !transcribeOff
            }
            aiGenerate={!aiGenerate}
            aiRevise={!aiRevise}
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

/**
 * Creating is paused: site-wide (maintenance or read-only, D155), or for
 * this account (`account`, D161).
 */
async function CreationPaused({ account = false }: { account?: boolean }) {
  const t = await getTranslations("create.paused");
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">
        {account ? t("accountTitle") : t("title")}
      </h1>
      <p role="status" className="mt-4 max-w-reading text-ink-muted">
        {account ? t("accountBody") : t("body")}
      </p>
      <div className="mt-8">
        <ButtonLink
          href={account ? "/feedback" : "/status"}
          variant="secondary"
          arrow
        >
          {account ? t("accountContact") : t("status")}
        </ButtonLink>
      </div>
    </main>
  );
}
