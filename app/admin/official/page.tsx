import type { Metadata } from "next";
import { oneLineTitle, practiceTitles } from "@/lib/titles";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { getAdminUser } from "@/auth/creator";
import { ButtonLink } from "@/components/ButtonLink";
import { MaterialControls } from "@/components/MaterialControls";
import { OfficialNotesUpgrade } from "@/components/OfficialNotesUpgrade";
import { CATEGORY_IDS, isCategoryId, isLevel } from "@/lib/categories";
import { parseMaterialMeta } from "@/lib/custom-practice/generation";
import { isRichNotes } from "@/lib/custom-practice/rich-notes";
import { officialState } from "@/lib/material-admin";
import { customPracticeId } from "@/lib/practice-material";

export const maxDuration = 60;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminOfficial");
  return { title: t("title") };
}

/**
 * Official materials (D80), apart from anyone's own practices: drafts
 * (admins only) and published ones (public, in the home page's library),
 * filtered by category. Each has its state, place in the library,
 * category, and subtitle (MaterialControls); new ones are written with
 * AI on /materials/new?official=1; notes not on the current version are
 * regenerated in a batch.
 */
export default async function OfficialMaterialsPage({
  searchParams,
}: PageProps<"/admin/official">) {
  const query = await searchParams;
  const category =
    typeof query.cat === "string" && isCategoryId(query.cat) ? query.cat : "";
  const [t, tc, actor] = await Promise.all([
    getTranslations("adminOfficial"),
    getTranslations("categories"),
    getAdminUser(),
  ]);
  const admin = getAdminSupabase();
  if (!admin) {
    return (
      <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
        <h1 className="font-display text-h1">{t("title")}</h1>
      </main>
    );
  }
  const { data: rows } = await admin
    .from("practices")
    .select(
      "id, title, title_en, title_zh, subtitle, user_id, official, published, sort_order, category, scenario, level, exam, exam_target, created_at, version, practice_sentences(audio_path, notes)",
    )
    .eq("official", true)
    .is("removed_at", null)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  const all = rows ?? [];
  const shown = category ? all.filter((p) => p.category === category) : all;
  const published = all.filter((p) => p.published).map((p) => p.id);
  const outdated = all.filter((p) =>
    p.practice_sentences.some((s) => !isRichNotes(s.notes)),
  );
  const categories = CATEGORY_IDS.filter((id) =>
    all.some((p) => p.category === id),
  );

  const section = (state: "draft" | "published") => {
    const list = shown.filter((p) => p.published === (state === "published"));
    return (
      <section aria-labelledby={`official-${state}`} className="mt-10">
        <h2 id={`official-${state}`} className="font-display text-h2">
          {t(`sections.${state}`, { count: list.length })}
        </h2>
        {list.length === 0 ? (
          <p className="mt-4 text-ink-muted">{t(`empty.${state}`)}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {list.map((practice) => {
              const sentences = practice.practice_sentences;
              const voiced = sentences.filter((s) => s.audio_path).length;
              const current = sentences.every((s) => isRichNotes(s.notes));
              const meta = parseMaterialMeta({
                category: practice.category,
                scenario: practice.scenario,
                level: isLevel(practice.level) ? practice.level : null,
                exam: practice.exam,
                examTarget: practice.exam_target,
              });
              const position = published.indexOf(practice.id);
              return (
                <li key={practice.id} className="space-y-3 py-5">
                  <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <Link
                      href={`/videos/${customPracticeId(practice.id)}`}
                      className="tap font-medium underline-offset-4 hover:underline"
                    >
                      {oneLineTitle(practiceTitles(practice))}
                    </Link>
                    <span className="text-supporting text-ink-muted">
                      {[
                        meta
                          ? [
                              tc(`names.${meta.category}`),
                              meta.scenario
                                ? tc(
                                    `scenarios.${meta.scenario}` as "scenarios.restaurant",
                                  )
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : t("noCategory"),
                        t("sentences", { count: sentences.length }),
                        current ? t("notesCurrent") : t("notesOld"),
                        voiced < sentences.length
                          ? t("audio", { voiced, total: sentences.length })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </p>
                  {practice.subtitle && (
                    <p className="text-supporting text-ink-muted">
                      {practice.subtitle}
                    </p>
                  )}
                  <MaterialControls
                    practice={{
                      id: practice.id,
                      title: practice.title,
                      subtitle: practice.subtitle,
                      state: officialState(practice),
                      position: position === -1 ? null : position,
                      published: published.length,
                      meta,
                      editable: practice.user_id === actor?.id,
                    }}
                  />
                  {practice.user_id !== actor?.id && (
                    <p className="text-metadata text-ink-muted">
                      {t("otherAuthor")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  };

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-h1">{t("title")}</h1>
        <ButtonLink href="/materials/new?official=1" variant="primary">
          {t("create")}
        </ButtonLink>
      </div>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>

      {categories.length > 0 && (
        <nav
          aria-label={t("filterLabel")}
          className="mt-8 flex flex-wrap gap-2"
        >
          {["", ...categories].map((id) => {
            const on = id === category;
            return (
              <Link
                key={id || "all"}
                href={id ? `/admin/official?cat=${id}` : "/admin/official"}
                aria-current={on ? "page" : undefined}
                className={`inline-flex h-8 items-center rounded-base border px-3 text-supporting pointer-coarse:min-h-11 ${
                  on
                    ? "border-ink bg-ink text-ground"
                    : "border-line text-ink-muted hover:border-ink-muted hover:text-ink"
                }`}
              >
                {on && <span aria-hidden="true">✓ </span>}
                {id ? tc(`names.${id as "travel"}`) : t("allCategories")}
              </Link>
            );
          })}
        </nav>
      )}

      <section
        aria-labelledby="official-upgrade"
        className="mt-8 max-w-practice rounded-base border border-line bg-surface p-6"
      >
        <h2 id="official-upgrade" className="font-display text-h3">
          {t("upgrade.title")}
        </h2>
        <div className="mt-4">
          <OfficialNotesUpgrade
            items={outdated.map((p) => ({ id: p.id, title: p.title }))}
          />
        </div>
      </section>

      {section("draft")}
      {section("published")}
    </main>
  );
}
