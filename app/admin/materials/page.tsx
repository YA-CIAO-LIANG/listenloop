import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { getAdminUser } from "@/auth/creator";
import { Button } from "@/components/Button";
import { MaterialControls } from "@/components/MaterialControls";
import {
  ModerationControls,
  RestorePracticeButton,
} from "@/components/ModerationControls";
import { userNumberLabel } from "@/lib/accounts";
import {
  CATEGORY_IDS,
  EXAMS,
  isCategoryId,
  isExamId,
  isLevel,
} from "@/lib/categories";
import { parseMaterialMeta } from "@/lib/custom-practice/generation";
import {
  MATERIAL_FILTERS,
  officialState,
  type MaterialFilter,
} from "@/lib/material-admin";
import { isReportReason } from "@/lib/moderation";
import { customPracticeId } from "@/lib/practice-material";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.materials");
  return { title: t("title") };
}

const fieldClass =
  "block w-full rounded-base border border-line bg-surface px-3 py-2 text-supporting focus-visible:border-accent pointer-coarse:min-h-11";

/**
 * Official and public materials (D58): each one's official state (draft
 * or published), its place in the library, its category, takedown or
 * restore, and its edit page when you made it. Filters by category,
 * exam, and status are a GET form.
 */
export default async function AdminMaterialsPage({
  searchParams,
}: PageProps<"/admin/materials">) {
  const query = await searchParams;
  const one = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : "";
  const category = isCategoryId(one("category")) ? one("category") : "";
  const exam = isExamId(one("exam")) ? one("exam") : "";
  const status: MaterialFilter = (
    MATERIAL_FILTERS as readonly string[]
  ).includes(one("status"))
    ? (one("status") as MaterialFilter)
    : "all";
  const [t, tc, tReasons, format, actor] = await Promise.all([
    getTranslations("admin.materials"),
    getTranslations("categories"),
    getTranslations("report.reasons"),
    getFormatter(),
    getAdminUser(),
  ]);
  const admin = getAdminSupabase();
  let request = admin
    ?.from("practices")
    .select(
      "id, title, subtitle, user_id, visibility, official, published, sort_order, removed_at, removed_reason, category, scenario, level, exam, exam_target, created_at, notes_generated_at, practice_sentences(audio_path)",
    )
    // Official materials are managed on /admin/official (D80).
    .eq("official", false)
    .or("visibility.eq.public,removed_at.not.is.null")
    .order("created_at", { ascending: false })
    .limit(200);
  if (request && category) request = request.eq("category", category);
  if (request && exam) request = request.eq("exam", exam);
  if (request && status === "public") {
    request = request.eq("visibility", "public").is("removed_at", null);
  }
  if (request && status === "removed") {
    request = request.not("removed_at", "is", null);
  }
  const { data: rows } = request ? await request : { data: null };
  const practices = rows ?? [];

  // The library's current order, for "3 of 12" and the arrows.
  const { data: publishedRows } = admin
    ? await admin
        .from("practices")
        .select("id")
        .eq("official", true)
        .eq("published", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
    : { data: null };
  const order = (publishedRows ?? []).map((row) => row.id);

  // A date, or a dash for a missing or broken one (never a thrown error).
  const day = (iso: string | null | undefined) => {
    const date = new Date(iso ?? "");
    return Number.isNaN(date.getTime())
      ? "—"
      : format.dateTime(date, { dateStyle: "medium" });
  };

  const authorIds = [...new Set(practices.map((p) => p.user_id))];
  const { data: profiles } =
    admin && authorIds.length
      ? await admin
          .from("profiles")
          .select("user_id, number")
          .in("user_id", authorIds)
      : { data: null };
  const numbers = new Map((profiles ?? []).map((p) => [p.user_id, p.number]));

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <form
        method="get"
        className="mt-8 grid gap-4 split:grid-cols-2 wide:grid-cols-4 wide:items-end"
      >
        <label className="space-y-1 text-supporting">
          <span>{t("filters.category")}</span>
          <select
            name="category"
            defaultValue={category}
            className={fieldClass}
          >
            <option value="">{t("filters.all")}</option>
            {CATEGORY_IDS.map((id) => (
              <option key={id} value={id}>
                {tc(`names.${id}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-supporting">
          <span>{t("filters.exam")}</span>
          <select name="exam" defaultValue={exam} className={fieldClass}>
            <option value="">{t("filters.all")}</option>
            {EXAMS.map((e) => (
              <option key={e.id} value={e.id}>
                {tc(`exams.${e.id}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-supporting">
          <span>{t("filters.status")}</span>
          <select name="status" defaultValue={status} className={fieldClass}>
            {MATERIAL_FILTERS.map((value) => (
              <option key={value} value={value}>
                {t(`filters.statuses.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <div>
          <Button type="submit" variant="secondary">
            {t("filters.apply")}
          </Button>
        </div>
      </form>

      {practices.length === 0 ? (
        <p className="mt-8 text-ink-muted">{t("none")}</p>
      ) : (
        <ul className="mt-8 max-w-practice divide-y divide-line border-y border-line">
          {practices.map((practice) => {
            const sentences = practice.practice_sentences;
            const voiced = sentences.filter((s) => s.audio_path).length;
            const ready =
              practice.notes_generated_at !== null &&
              sentences.length > 0 &&
              voiced === sentences.length;
            const meta = parseMaterialMeta({
              category: practice.category,
              scenario: practice.scenario,
              level: isLevel(practice.level) ? practice.level : null,
              exam: practice.exam,
              examTarget: practice.exam_target,
            });
            const position = order.indexOf(practice.id);
            const author = numbers.get(practice.user_id);
            return (
              <li key={practice.id} className="space-y-3 py-5">
                <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <Link
                    href={`/videos/${customPracticeId(practice.id)}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {practice.title}
                  </Link>
                  <span className="text-supporting text-ink-muted">
                    {[
                      author !== undefined
                        ? t("author", { number: userNumberLabel(author) })
                        : null,
                      day(practice.created_at),
                      t("sentences", { count: sentences.length }),
                      meta
                        ? [
                            tc(`names.${meta.category}`),
                            meta.exam
                              ? tc(`exams.${meta.exam as "toefl"}`)
                              : null,
                            meta.scenario
                              ? tc(
                                  `scenarios.${meta.scenario}` as "scenarios.restaurant",
                                )
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : t("noCategory"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </p>
                <p className="text-supporting">
                  <span
                    className={
                      practice.removed_at ? "text-error" : "text-ink-muted"
                    }
                  >
                    {practice.removed_at
                      ? t("removed", {
                          reason: isReportReason(practice.removed_reason)
                            ? tReasons(practice.removed_reason)
                            : tReasons("other"),
                        })
                      : t(
                          `visibility.${practice.visibility === "public" ? "public" : "private"}`,
                        )}
                  </span>
                  {!ready && (
                    <span className="text-ink-muted">
                      {" · "}
                      {t("notReady", { voiced, total: sentences.length })}
                    </span>
                  )}
                </p>
                {!practice.removed_at && (
                  <MaterialControls
                    manageOfficial={false}
                    practice={{
                      id: practice.id,
                      title: practice.title,
                      subtitle: practice.subtitle,
                      state: officialState(practice),
                      position: position === -1 ? null : position,
                      published: order.length,
                      meta,
                      editable: practice.user_id === actor?.id,
                    }}
                  />
                )}
                {practice.removed_at ? (
                  <RestorePracticeButton
                    practiceId={practice.id}
                    title={practice.title}
                  />
                ) : (
                  practice.visibility === "public" && (
                    <ModerationControls
                      practiceId={practice.id}
                      title={practice.title}
                      defaultReason="other"
                      showDismiss={false}
                    />
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
