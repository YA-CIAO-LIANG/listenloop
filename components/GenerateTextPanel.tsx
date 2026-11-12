"use client";

import { UsageLimitMessage } from "./UsageLimitMessage";
import type { UsageBlock } from "@/lib/usage";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
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
  isGeneralCategory,
  LEVELS,
  OTHER_CATEGORY,
  type CategoryId,
  type Scenario,
  targetMessageKey,
} from "@/lib/categories";
import {
  CUSTOM_LENGTH,
  GENERATION_FORMATS,
  GENERATION_LENGTHS,
  lengthSeconds,
  CUSTOM_CATEGORY_MAX_CHARS,
  CUSTOM_SCENARIO_MAX_CHARS,
  guessedMeta,
  materialMeta,
  type GenerationFormat,
  type GenerationLength,
  type GenerationRequest,
  type MaterialMeta,
} from "@/lib/custom-practice/generation";
import { withSpeakers } from "@/lib/custom-practice/speakers";
import { PLANS } from "@/lib/plans";
import Link from "next/link";
import { usePlan } from "./PlanProvider";
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
  /**
   * The category is AI's guess (D154): the learner left it open, so the
   * review step shows it to change.
   */
  categoryGuessed: boolean;
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
    lengthHint: useId(),
  };
  // A category of one's own first (D154), with the cursor in its name;
  // left empty, AI files the text and the review step shows where.
  const [category, setCategory] = useState<CategoryId>(OTHER_CATEGORY);
  const [customCategory, setCustomCategory] = useState("");
  const customCategoryRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    customCategoryRef.current?.focus();
  }, []);
  const [exam, setExam] = useState<string>(EXAMS[0].id);
  const [scenario, setScenario] = useState<string>("");
  const [customScenario, setCustomScenario] = useState("");
  const [level, setLevel] = useState<string>("intermediate");
  // The plan's longest practice (D94): longer choices aren't offered.
  const plan = usePlan();
  const maxSeconds = Math.min(
    PLANS[plan].maxPracticeSeconds ?? CUSTOM_LENGTH.max,
    CUSTOM_LENGTH.max,
  );
  const lengths = GENERATION_LENGTHS.filter(
    (value) => value === "custom" || lengthSeconds(value) <= maxSeconds,
  );
  const [length, setLength] = useState<GenerationLength>(
    lengths.includes("2-3") ? "2-3" : "30s",
  );
  const [customMinutes, setCustomMinutes] = useState(
    String(Math.floor(Math.min(90, maxSeconds) / 60)),
  );
  const [customSecs, setCustomSecs] = useState(
    String(Math.min(90, maxSeconds) % 60),
  );
  const customSeconds =
    (Number(customMinutes) || 0) * 60 + (Number(customSecs) || 0);
  const customOk =
    Number.isInteger(customSeconds) &&
    customSeconds >= CUSTOM_LENGTH.min &&
    customSeconds <= maxSeconds;
  // A monologue unless the learner picks a dialogue (D82).
  const [format, setFormat] = useState<GenerationFormat>("monologue");
  const [accent, setAccent] = useState<VoiceAccent>("us");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<
    Extract<GenerateTextResult, { ok: false }>["reason"] | null
  >(null);
  const [usage, setUsage] = useState<UsageBlock | undefined>(undefined);
  const [tooLongMax, setTooLongMax] = useState(0);

  const isExam = category === EXAM_CATEGORY;
  const isOther = category === OTHER_CATEGORY;
  const currentExam = EXAMS.find((e) => e.id === exam) ?? EXAMS[0];
  const scenarios = scenariosOf(category, exam);
  // What's required: a scenario from the list, or something described.
  const needsOwnScenario = !isOther && scenario === "";
  const missing =
    (needsOwnScenario && !customScenario.trim()) ||
    (length === "custom" && !customOk);

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
      ...(length === "custom" ? { seconds: customSeconds } : {}),
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
      if (result.reason === "tooLong" || result.reason === "weekLeft") {
        setTooLongMax(result.max ?? 0);
      } else if ("limit" in result) setUsage(result.limit);
      return;
    }
    // Filed by the learner (D57, D82); a chosen category with a situation
    // of one's own (D154); or, left open, where AI filed it (D154).
    const chosen = materialMeta(request);
    const guessed = !chosen && isOther;
    const meta: MaterialMeta | null =
      chosen ??
      (guessed
        ? guessedMeta(request, result.category)
        : isGeneralCategory(category)
          ? guessedMeta(request, category)
          : null);
    onGenerated({
      titleEn: result.titleEn,
      titleZh: result.titleZh,
      subtitle: result.subtitle,
      text: format === "dialogue" ? withSpeakers(result.text) : result.text,
      meta,
      categoryGuessed: guessed,
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

  const duration = (seconds: number) =>
    t("duration", { minutes: Math.floor(seconds / 60), seconds: seconds % 60 });
  const numberClass =
    "h-10 w-20 rounded-base border border-line bg-surface px-3 text-body tabular-nums focus-visible:border-accent pointer-coarse:min-h-11";
  // One's own length (D94), and how long the plan allows.
  const lengthDetails = (
    <>
      {length === "custom" && (
        <fieldset className="space-y-2">
          <legend className="text-supporting">{t("customLength")}</legend>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={Math.floor(maxSeconds / 60)}
                value={customMinutes}
                onChange={(event) => setCustomMinutes(event.target.value)}
                aria-describedby={ids.lengthHint}
                className={numberClass}
              />
              {t("customMinutes")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                step={5}
                value={customSecs}
                onChange={(event) => setCustomSecs(event.target.value)}
                aria-describedby={ids.lengthHint}
                className={numberClass}
              />
              {t("customSeconds")}
            </label>
          </div>
          <p
            id={ids.lengthHint}
            className={`text-supporting ${customOk ? "text-ink-muted" : "text-error"}`}
          >
            {t("customLengthHint", { max: duration(maxSeconds) })}
          </p>
        </fieldset>
      )}
      {maxSeconds < CUSTOM_LENGTH.max && (
        <p className="text-supporting text-ink-muted">
          {t("planLength", { max: duration(maxSeconds) })}{" "}
          <Link
            href="/pricing?from=length"
            className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
          >
            {t("seePlans")}
          </Link>
        </p>
      )}
    </>
  );

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
              ref={customCategoryRef}
              id={ids.customCategory}
              type="text"
              value={customCategory}
              maxLength={CUSTOM_CATEGORY_MAX_CHARS}
              placeholder={t("customCategoryPlaceholder")}
              aria-describedby={ids.customCategoryHint}
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
            lengths.map((value) => ({
              value,
              label:
                value === "30s" || value === "custom"
                  ? t(`lengthOptions.${value}`)
                  : t("length", { range: value.replace("-", "–") }),
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
          {key === "lengthLegend" && lengthDetails}
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
          ) : error === "tooLong" || error === "weekLeft" ? (
            t(`errors.${error}`, { max: tooLongMax })
          ) : (
            t(`errors.${error}`)
          )}
        </p>
      )}
    </div>
  );
}
