"use client";

import { UsageLimitMessage } from "./UsageLimitMessage";
import type { UsageBlock } from "@/lib/usage";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  generatePracticeText,
  type GenerateTextResult,
} from "@/app/materials/actions";
import { VOICE_ACCENTS, type VoiceAccent } from "@/lib/ai/types";
import {
  CATEGORIES,
  CATEGORY_IDS,
  EXAM_CATEGORY,
  EXAMS,
  LEVELS,
  OTHER_CATEGORY,
  type CategoryId,
  type Scenario,
  targetMessageKey,
} from "@/lib/categories";
import {
  GENERATION_FORMATS,
  GENERATION_LENGTHS,
  CUSTOM_CATEGORY_MAX_CHARS,
  CUSTOM_SCENARIO_MAX_CHARS,
  materialMeta,
  type GenerationFormat,
  type GenerationLength,
  type GenerationRequest,
  type MaterialMeta,
} from "@/lib/custom-practice/generation";
import { withSpeakers } from "@/lib/custom-practice/speakers";
import { Button } from "./Button";
import { SegmentedControl } from "./SegmentedControl";

export type GenerateText = (
  request: GenerationRequest,
) => Promise<GenerateTextResult>;

export type GeneratedPractice = {
  titleEn: string;
  titleZh: string;
  subtitle: string;
  text: string;
  /** Where it belongs, saved with the practice (D57). */
  meta: MaterialMeta | null;
  accent: VoiceAccent;
  format: GenerationFormat;
};

type GenerateTextPanelProps = {
  /**
   * The titles typed at the top of the form (D82, D83): each kept
   * exactly when given, else the model writes it.
   */
  titles: { en: string; zh: string };
  /** The written title and text, for the learner to review and edit. */
  onGenerated: (generated: GeneratedPractice) => void;
  /** Injected in tests; the Server Action otherwise. */
  generate?: GenerateText;
};

const fieldClass =
  "block w-full max-w-md rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent";

/** The scenarios a category offers (an exam's parts for exam listening). */
function scenariosOf(category: CategoryId, exam: string): readonly Scenario[] {
  if (category === EXAM_CATEGORY) {
    return EXAMS.find((e) => e.id === exam)?.parts ?? EXAMS[0].parts;
  }
  return CATEGORIES.find((c) => c.id === category)?.scenarios ?? [];
}

/**
 * The second way to start a practice (e+ 5, D36, D57, D81, D82), in the
 * order a first-timer decides: what it's about (a category and scenario
 * from the lists, or one's own category, and the situation in one's own
 * words), then how hard, how long, monologue or dialogue, and the
 * accent. The language model writes English text; a dialogue comes back
 * with "A:" and "B:" on its lines. The text lands in the regular form to
 * edit, then goes through the same split, translate, and review steps.
 */
export function GenerateTextPanel({
  titles,
  onGenerated,
  generate = generatePracticeText,
}: GenerateTextPanelProps) {
  const t = useTranslations("generate");
  const tc = useTranslations("categories");
  const ids = {
    category: useId(),
    customCategory: useId(),
    customCategoryHint: useId(),
    exam: useId(),
    scenario: useId(),
    custom: useId(),
    customHint: useId(),
  };
  const [category, setCategory] = useState<CategoryId>(CATEGORY_IDS[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [exam, setExam] = useState<string>(EXAMS[0].id);
  const [scenario, setScenario] = useState<string>(
    CATEGORIES[0].scenarios[0].id,
  );
  const [customScenario, setCustomScenario] = useState("");
  const [level, setLevel] = useState<string>("intermediate");
  const [length, setLength] = useState<GenerationLength>("2-3");
  // A monologue unless the learner picks a dialogue (D82).
  const [format, setFormat] = useState<GenerationFormat>("monologue");
  const [accent, setAccent] = useState<VoiceAccent>("us");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<
    Extract<GenerateTextResult, { ok: false }>["reason"] | null
  >(null);
  const [usage, setUsage] = useState<UsageBlock | undefined>(undefined);

  const isExam = category === EXAM_CATEGORY;
  const isOther = category === OTHER_CATEGORY;
  const currentExam = EXAMS.find((e) => e.id === exam) ?? EXAMS[0];
  const scenarios = scenariosOf(category, exam);
  // What's required: a scenario from the list, or something described.
  const needsOwnScenario = !isOther && scenario === "";
  const missing =
    (isOther && !customCategory.trim()) ||
    (needsOwnScenario && !customScenario.trim());

  /** An exam gets its middle target; other categories a general level. */
  function chooseCategory(next: CategoryId) {
    setCategory(next);
    setScenario(
      next === OTHER_CATEGORY ? "" : (scenariosOf(next, exam)[0]?.id ?? ""),
    );
    if (next === EXAM_CATEGORY) {
      setLevel(
        currentExam.targets[Math.floor(currentExam.targets.length / 2)].id,
      );
    } else if (!(LEVELS as readonly string[]).includes(level)) {
      setLevel("intermediate");
    }
  }
  function chooseExam(next: string) {
    setExam(next);
    const chosen = EXAMS.find((e) => e.id === next) ?? EXAMS[0];
    setScenario(chosen.parts[0].id);
    setLevel(chosen.targets[Math.floor(chosen.targets.length / 2)].id);
  }

  async function submit() {
    setPending(true);
    setError(null);
    const request: GenerationRequest = {
      topic: "",
      scenario: isOther ? "" : scenario,
      customScenario,
      customCategory: isOther ? customCategory : "",
      titleEn: titles.en,
      titleZh: titles.zh,
      level,
      length,
      format,
      accent,
    };
    const result = await generate(request).catch((): GenerateTextResult => ({
      ok: false,
      reason: "failed",
    }));
    setPending(false);
    if (!result.ok) {
      setError(result.reason);
      setUsage(result.limit);
      return;
    }
    onGenerated({
      titleEn: result.titleEn,
      titleZh: result.titleZh,
      subtitle: result.subtitle,
      text: format === "dialogue" ? withSpeakers(result.text) : result.text,
      meta: materialMeta(request),
      accent,
      format,
    });
  }

  const levelOptions = isExam
    ? currentExam.targets.map((target) => ({
        value: target.id,
        label: tc(
          `targets.${targetMessageKey(target.id)}` as "targets.toefl-80",
        ),
      }))
    : LEVELS.map((value) => ({ value, label: tc(`levels.${value}`) }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 split:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor={ids.category} className="block font-medium">
            {t("categoryLabel")}
          </label>
          <select
            id={ids.category}
            value={category}
            onChange={(event) =>
              chooseCategory(event.target.value as CategoryId)
            }
            disabled={pending}
            className={fieldClass}
          >
            {CATEGORY_IDS.map((id) => (
              <option key={id} value={id}>
                {id === OTHER_CATEGORY
                  ? t("customCategoryOption")
                  : tc(`names.${id}`)}
              </option>
            ))}
          </select>
        </div>
        {isExam && (
          <div className="space-y-2">
            <label htmlFor={ids.exam} className="block font-medium">
              {t("examLabel")}
            </label>
            <select
              id={ids.exam}
              value={exam}
              onChange={(event) => chooseExam(event.target.value)}
              disabled={pending}
              className={fieldClass}
            >
              {EXAMS.map((option) => (
                <option key={option.id} value={option.id}>
                  {tc(`exams.${option.id}`)}
                </option>
              ))}
            </select>
          </div>
        )}
        {isOther ? (
          <div className="space-y-2">
            <label htmlFor={ids.customCategory} className="block font-medium">
              {t("customCategoryLabel")}
            </label>
            <input
              id={ids.customCategory}
              type="text"
              value={customCategory}
              maxLength={CUSTOM_CATEGORY_MAX_CHARS}
              placeholder={t("customCategoryPlaceholder")}
              aria-describedby={ids.customCategoryHint}
              aria-required
              onChange={(event) => setCustomCategory(event.target.value)}
              disabled={pending}
              className={fieldClass}
            />
            <p
              id={ids.customCategoryHint}
              className="text-supporting text-ink-muted"
            >
              {t("customCategoryHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <label htmlFor={ids.scenario} className="block font-medium">
              {t("scenarioLabel")}
            </label>
            <select
              id={ids.scenario}
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
              disabled={pending}
              className={fieldClass}
            >
              {scenarios.map((option) => (
                <option key={option.id} value={option.id}>
                  {tc(`scenarios.${option.id}` as "scenarios.restaurant")}
                </option>
              ))}
              {/* Exam parts are fixed formats; elsewhere one's own will do (D81). */}
              {!isExam && <option value="">{t("customOnly")}</option>}
            </select>
          </div>
        )}
      </div>
      {isExam && (
        <p className="text-supporting text-ink-muted">{tc("examNote")}</p>
      )}
      <div className="space-y-2">
        <label htmlFor={ids.custom} className="block font-medium">
          {needsOwnScenario ? t("customRequired") : t("customLabel")}
        </label>
        <p id={ids.customHint} className="text-supporting text-ink-muted">
          {t("customHint")}
        </p>
        <textarea
          id={ids.custom}
          rows={3}
          value={customScenario}
          maxLength={CUSTOM_SCENARIO_MAX_CHARS}
          placeholder={t("customPlaceholder")}
          aria-describedby={ids.customHint}
          aria-required={needsOwnScenario}
          onChange={(event) => setCustomScenario(event.target.value)}
          disabled={pending}
          className="block w-full resize-y rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent"
        />
      </div>
      {(
        [
          [
            isExam ? "targetLegend" : "levelLegend",
            level,
            levelOptions,
            setLevel,
          ],
          [
            "lengthLegend",
            length,
            GENERATION_LENGTHS.map((value) => ({
              value,
              label: t("length", { range: value.replace("-", "–") }),
            })),
            (value: string) => setLength(value as GenerationLength),
          ],
          [
            "formatLegend",
            format,
            GENERATION_FORMATS.map((value) => ({
              value,
              label: t(`formats.${value}`),
            })),
            (value: string) => setFormat(value as GenerationFormat),
          ],
          [
            "accentLegend",
            accent,
            VOICE_ACCENTS.map((value) => ({
              value,
              label: t(`accents.${value}`),
            })),
            (value: string) => setAccent(value as VoiceAccent),
          ],
        ] as const
      ).map(([key, value, options, onChange]) => (
        <div key={key} className="space-y-2">
          <p aria-hidden="true" className="font-medium">
            {t(key)}
          </p>
          <SegmentedControl
            legend={t(key)}
            value={value}
            options={[...options]}
            onChange={onChange}
            optionWidthClassName="min-w-16"
          />
        </div>
      ))}
      <p className="text-supporting text-ink-muted">{t("note")}</p>
      <Button
        variant="primary"
        arrow
        onClick={submit}
        disabled={pending || missing}
      >
        {pending ? t("generating") : t("generate")}
      </Button>
      {missing && !pending && (
        <p className="text-supporting text-ink-muted">
          {isOther ? t("needCategory") : t("needScenario")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-supporting text-error">
          {error === "limit" ? (
            <UsageLimitMessage block={usage} fallback={t("errors.limit")} />
          ) : (
            t(`errors.${error}`)
          )}
        </p>
      )}
    </div>
  );
}
