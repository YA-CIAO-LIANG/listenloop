import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { ContentFixActions } from "@/components/ContentFixActions";
import { SentenceExplanation } from "@/components/SentenceExplanation";
import {
  FIX_KINDS,
  SHORTEN_STEPS,
  textLength,
  type FixKind,
  type ShortenStep,
} from "@/lib/content-fixes";
import { parseRichNotes } from "@/lib/custom-practice/rich-notes";
import { customPracticeId } from "@/lib/practice-material";
import { practiceTitles } from "@/lib/titles";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.fixes");
  return { title: t("title") };
}

/** Pending fixes read at most. */
const FIXES_READ = 500;

const isKind = (value: unknown): value is FixKind =>
  (FIX_KINDS as readonly unknown[]).includes(value);

/**
 * Suggested fixes to published official materials (D117), waiting for an
 * admin: each shows the sentence, what it says now, the suggestion, and
 * why, with accept and reject. Nothing changes until it's accepted.
 */
export default async function AdminFixesPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind: kindParam } = await searchParams;
  const kind = isKind(kindParam) ? kindParam : null;
  const t = await getTranslations("admin.fixes");
  const admin = getAdminSupabase();
  const { data: fixes } = admin
    ? await admin
        .from("content_fixes")
        .select(
          "id, practice_id, sentence_index, field, kind, current, suggested, reason, detail",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(FIXES_READ)
    : { data: null };
  const all = fixes ?? [];
  const shown = kind ? all.filter((f) => f.kind === kind) : all;

  const ids = [...new Set(shown.map((f) => f.practice_id))];
  const { data: practices } =
    admin && ids.length
      ? await admin
          .from("practices")
          .select("id, title, title_en, title_zh, practice_sentences(i, en)")
          .in("id", ids)
      : { data: null };
  const byId = new Map((practices ?? []).map((p) => [p.id, p]));
  const groups = ids.map((id) => ({
    id,
    practice: byId.get(id),
    fixes: shown
      .filter((f) => f.practice_id === id)
      .sort((a, b) => a.sentence_index - b.sentence_index),
  }));
  const count = (k: FixKind | null) =>
    k ? all.filter((f) => f.kind === k).length : all.length;
  const stepsOf = (detail: unknown): ShortenStep[] => {
    const steps = (detail as { steps?: unknown } | null)?.steps;
    return Array.isArray(steps)
      ? steps.filter((s): s is ShortenStep =>
          (SHORTEN_STEPS as readonly unknown[]).includes(s),
        )
      : [];
  };

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>

      <nav aria-label={t("filter")} className="mt-8">
        <ul className="flex flex-wrap gap-2">
          {[null, ...FIX_KINDS].map((k) => (
            <li key={k ?? "all"}>
              <Link
                href={k ? `/admin/fixes?kind=${k}` : "/admin/fixes"}
                aria-current={k === kind ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 text-supporting ${
                  k === kind
                    ? "border-accent bg-accent/14 text-accent-ink"
                    : "border-line text-ink-muted hover:text-ink"
                }`}
              >
                {t(k ? `kinds.${k}` : "all")}
                <span className="ml-2 tabular-nums">{count(k)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {groups.length === 0 ? (
        <p className="mt-8 text-ink-muted">{t("none")}</p>
      ) : (
        <div className="mt-8 space-y-12">
          {groups.map(({ id, practice, fixes: list }) => {
            const titles = practice ? practiceTitles(practice) : null;
            const en = (i: number) =>
              practice?.practice_sentences.find((s) => s.i === i)?.en ?? "";
            return (
              <section key={id} aria-labelledby={`fix-${id}`}>
                <h2 id={`fix-${id}`} className="font-display text-h2">
                  <Link
                    href={`/videos/${customPracticeId(id)}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {titles?.en || practice?.title || id}
                  </Link>
                </h2>
                {titles?.zh && (
                  <p className="mt-1 text-supporting text-ink-muted">
                    {titles.zh}
                  </p>
                )}
                <ol className="mt-4 max-w-practice divide-y divide-line border-y border-line">
                  {list.map((fix) => {
                    const sentence = en(fix.sentence_index);
                    const steps = stepsOf(fix.detail);
                    const before =
                      fix.field === "notes"
                        ? parseRichNotes(fix.current, sentence)
                        : null;
                    const after =
                      fix.field === "notes"
                        ? parseRichNotes(fix.suggested, sentence)
                        : null;
                    return (
                      <li key={fix.id} className="space-y-3 py-5">
                        <p className="text-supporting text-ink-muted">
                          {t("where", {
                            n: fix.sentence_index + 1,
                            kind: t(`kinds.${fix.kind as FixKind}`),
                          })}
                        </p>
                        <p lang="en" className="text-sentence">
                          {sentence}
                        </p>
                        {fix.field === "zh" ? (
                          <dl className="grid gap-x-4 gap-y-1 text-body split:grid-cols-[6rem_1fr]">
                            <dt className="text-supporting text-ink-muted">
                              {t("current")}
                            </dt>
                            <dd>{String(fix.current)}</dd>
                            <dt className="text-supporting text-ink-muted">
                              {t("suggested")}
                            </dt>
                            <dd className="font-medium">
                              {String(fix.suggested)}
                            </dd>
                          </dl>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-body">
                              {t("notesLength", {
                                before: textLength(fix.current),
                                after: textLength(fix.suggested),
                              })}
                            </p>
                            {steps.length > 0 && (
                              <ul className="list-disc space-y-1 pl-5 text-supporting">
                                {steps.map((step) => (
                                  <li key={step}>{t(`steps.${step}`)}</li>
                                ))}
                              </ul>
                            )}
                            <details className="text-supporting">
                              <summary className="cursor-pointer text-accent-ink underline underline-offset-4">
                                {t("compare")}
                              </summary>
                              <div className="mt-4 grid gap-6 split:grid-cols-2">
                                {(
                                  [
                                    ["current", before],
                                    ["suggested", after],
                                  ] as const
                                ).map(([label, rich]) => (
                                  <div key={label}>
                                    <h3 className="text-supporting font-medium">
                                      {t(label)}
                                    </h3>
                                    {rich ? (
                                      <SentenceExplanation
                                        en={sentence}
                                        zh=""
                                        rich={rich}
                                        legacy={{ vocab: [], grammar: [] }}
                                        missed={null}
                                        showZh={false}
                                      />
                                    ) : (
                                      <p className="text-ink-muted">—</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}
                        <p className="text-supporting text-ink-muted">
                          {fix.reason ?? t(`reasons.${fix.kind as FixKind}`)}
                        </p>
                        <ContentFixActions id={fix.id} />
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
