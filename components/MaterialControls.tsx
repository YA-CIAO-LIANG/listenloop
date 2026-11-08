"use client";

import { UsageLimitMessage } from "./UsageLimitMessage";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  generateMaterialSubtitle as generateMaterialSubtitleAction,
  moveOfficial as moveOfficialAction,
  setMaterialCategory as setMaterialCategoryAction,
  setMaterialSubtitle as setMaterialSubtitleAction,
  setOfficialState as setOfficialStateAction,
  type MaterialResult,
} from "@/app/admin/materials/actions";
import {
  CATEGORIES,
  CATEGORY_IDS,
  EXAM_CATEGORY,
  EXAMS,
  findScenario,
  LEVELS,
  type CategoryId,
  targetMessageKey,
} from "@/lib/categories";
import type { MaterialMeta } from "@/lib/custom-practice/generation";
import type { OfficialState } from "@/lib/material-admin";
import { Button } from "./Button";
import { useRouter } from "next/navigation";

const selectClass =
  "h-8 rounded-base border border-line bg-surface px-2 text-supporting focus-visible:border-accent pointer-coarse:min-h-11";

type MaterialControlsProps = {
  practice: {
    id: string;
    title: string;
    /** The library card's one-line summary (D71). */
    subtitle: string | null;
    state: OfficialState;
    /** Position among published official practices, 0-based, or null. */
    position: number | null;
    published: number;
    meta: MaterialMeta | null;
    /** The viewer made it, so its edit page opens. */
    editable: boolean;
  };
  /** Injected in tests; the Server Actions otherwise. */
  setOfficialState?: typeof setOfficialStateAction;
  moveOfficial?: typeof moveOfficialAction;
  setMaterialCategory?: typeof setMaterialCategoryAction;
  setMaterialSubtitle?: typeof setMaterialSubtitleAction;
  generateMaterialSubtitle?: typeof generateMaterialSubtitleAction;
};

/**
 * One material's controls on the admin dashboard (D58): official state
 * (not official / draft / published), its place in the library, its
 * category, and a link to edit it.
 */
export function MaterialControls({
  practice,
  setOfficialState = setOfficialStateAction,
  moveOfficial = moveOfficialAction,
  setMaterialCategory = setMaterialCategoryAction,
  setMaterialSubtitle = setMaterialSubtitleAction,
  generateMaterialSubtitle = generateMaterialSubtitleAction,
}: MaterialControlsProps) {
  const t = useTranslations("admin.materials");
  const tc = useTranslations("categories");
  const router = useRouter();
  const ids = {
    state: useId(),
    category: useId(),
    scenario: useId(),
    level: useId(),
    subtitle: useId(),
    subtitleHint: useId(),
  };
  const [subtitle, setSubtitle] = useState(practice.subtitle ?? "");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<MaterialResult | null>(null);
  const [category, setCategory] = useState<CategoryId | "">(
    practice.meta?.category ?? "",
  );
  const [scenario, setScenario] = useState(practice.meta?.scenario ?? "");
  const [level, setLevel] = useState(
    practice.meta?.examTarget ?? practice.meta?.level ?? "intermediate",
  );

  async function run(action: () => Promise<MaterialResult>) {
    setPending(true);
    const outcome = await action().catch((): MaterialResult => ({
      ok: false,
      reason: "failed",
    }));
    setPending(false);
    setResult(outcome);
    if (outcome.ok) router.refresh();
  }

  const scenarios =
    category === EXAM_CATEGORY
      ? EXAMS.flatMap((exam) => exam.parts)
      : (CATEGORIES.find((c) => c.id === category)?.scenarios ?? []);
  const exam = findScenario(scenario)?.exam;
  const levelOptions = exam
    ? exam.targets.map((target) => ({
        value: target.id,
        label: tc(
          `targets.${targetMessageKey(target.id)}` as "targets.toefl-80",
        ),
      }))
    : LEVELS.map((value) => ({ value, label: tc(`levels.${value}`) }));

  function saveCategory() {
    if (!category || !findScenario(scenario)) {
      return run(() => setMaterialCategory(practice.id, null));
    }
    const target = exam?.targets.find((x) => x.id === level);
    const meta: MaterialMeta = {
      category,
      scenario,
      level: target
        ? target.level
        : (LEVELS.find((l) => l === level) ?? "intermediate"),
      exam: exam?.id ?? null,
      examTarget: target?.id ?? null,
    };
    return run(() => setMaterialCategory(practice.id, meta));
  }

  return (
    <div className="space-y-3 text-supporting">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label htmlFor={ids.state} className="text-ink-muted">
          {t("stateLabel")}
        </label>
        <select
          id={ids.state}
          value={practice.state}
          disabled={pending}
          onChange={(event) =>
            run(() => setOfficialState(practice.id, event.target.value))
          }
          className={selectClass}
        >
          {(["none", "draft", "published"] as const).map((state) => (
            <option key={state} value={state}>
              {t(`states.${state}`)}
            </option>
          ))}
        </select>
        {practice.position !== null && (
          <span className="flex items-center gap-1">
            <span className="text-ink-muted tabular-nums">
              {t("position", {
                n: practice.position + 1,
                total: practice.published,
              })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("moveUpLabel", { title: practice.title })}
              disabled={pending || practice.position === 0}
              onClick={() => run(() => moveOfficial(practice.id, -1))}
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("moveDownLabel", { title: practice.title })}
              disabled={pending || practice.position === practice.published - 1}
              onClick={() => run(() => moveOfficial(practice.id, 1))}
            >
              ↓
            </Button>
          </span>
        )}
        {practice.editable && (
          <Link
            href={`/materials/${practice.id}/edit`}
            className="text-accent-ink underline underline-offset-4"
          >
            {t("edit")}
          </Link>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={ids.category} className="sr-only">
          {t("categoryLabel")}
        </label>
        <select
          id={ids.category}
          value={category}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.value as CategoryId | "";
            setCategory(next);
            const first =
              next === EXAM_CATEGORY
                ? EXAMS[0].parts[0]
                : CATEGORIES.find((c) => c.id === next)?.scenarios[0];
            setScenario(first?.id ?? "");
            setLevel(
              next === EXAM_CATEGORY ? EXAMS[0].targets[0].id : "intermediate",
            );
          }}
          className={selectClass}
        >
          <option value="">{t("noCategory")}</option>
          {CATEGORY_IDS.map((id) => (
            <option key={id} value={id}>
              {tc(`names.${id}`)}
            </option>
          ))}
        </select>
        {category && (
          <>
            <label htmlFor={ids.scenario} className="sr-only">
              {t("scenarioLabel")}
            </label>
            <select
              id={ids.scenario}
              value={scenario}
              disabled={pending}
              onChange={(event) => {
                setScenario(event.target.value);
                const nextExam = findScenario(event.target.value)?.exam;
                if (nextExam) setLevel(nextExam.targets[0].id);
              }}
              className={selectClass}
            >
              {scenarios.map((option) => (
                <option key={option.id} value={option.id}>
                  {exam || category === EXAM_CATEGORY
                    ? `${tc(`exams.${findScenario(option.id)?.exam?.id ?? "toefl"}`)} · `
                    : ""}
                  {tc(`scenarios.${option.id}` as "scenarios.restaurant")}
                </option>
              ))}
            </select>
            <label htmlFor={ids.level} className="sr-only">
              {t("levelLabel")}
            </label>
            <select
              id={ids.level}
              value={level}
              disabled={pending}
              onChange={(event) => setLevel(event.target.value)}
              className={selectClass}
            >
              {levelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </>
        )}
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={saveCategory}
        >
          {t("saveCategory")}
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-60 flex-1 space-y-1">
          <label htmlFor={ids.subtitle} className="block text-ink-muted">
            {t("subtitleLabel")}
          </label>
          <input
            id={ids.subtitle}
            value={subtitle}
            maxLength={60}
            disabled={pending}
            aria-describedby={ids.subtitleHint}
            onChange={(event) => setSubtitle(event.target.value)}
            className="h-8 w-full rounded-base border border-line bg-surface px-2 focus-visible:border-accent pointer-coarse:min-h-11"
          />
          <p id={ids.subtitleHint} className="text-metadata text-ink-muted">
            {t("subtitleHint")}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending || subtitle === (practice.subtitle ?? "")}
          onClick={() =>
            run(() => setMaterialSubtitle(practice.id, subtitle.trim()))
          }
        >
          {t("saveSubtitle")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => run(() => generateMaterialSubtitle(practice.id))}
        >
          {t("generateSubtitle")}
        </Button>
      </div>
      <div aria-live="polite">
        {result &&
          (result.ok ? (
            <p className="text-success">{t("saved")}</p>
          ) : (
            <p role="alert" className="text-error">
              {result.reason === "limit" ? (
                <UsageLimitMessage
                  block={result.usage}
                  fallback={t("errors.limit")}
                />
              ) : (
                t(`errors.${result.reason}`)
              )}
            </p>
          ))}
      </div>
    </div>
  );
}
