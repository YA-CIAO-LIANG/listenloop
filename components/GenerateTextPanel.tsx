"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  generatePracticeText,
  type GenerateTextResult,
} from "@/app/materials/actions";
import {
  GENERATION_CATEGORIES,
  GENERATION_FORMATS,
  GENERATION_LEVELS,
  GENERATION_MINUTES,
  TOPIC_MAX_CHARS,
  type GenerationFormat,
  type GenerationLevel,
  type GenerationRequest,
} from "@/lib/custom-practice/generation";
import { Button } from "./Button";
import { SegmentedControl } from "./SegmentedControl";

export type GenerateText = (
  request: GenerationRequest,
) => Promise<GenerateTextResult>;

type GenerateTextPanelProps = {
  /** The written title and text, for the learner to review and edit. */
  onGenerated: (generated: { title: string; text: string }) => void;
  /** Injected in tests; the Server Action otherwise. */
  generate?: GenerateText;
};

const LEVELS = Object.keys(GENERATION_LEVELS) as GenerationLevel[];

/**
 * The second way to start a practice (e+ 5, D36): pick a scenario, level,
 * length, and format, optionally a topic, and the language model writes
 * English text. The text lands in the regular form to edit, then goes
 * through the same split, translate, and review steps.
 */
export function GenerateTextPanel({
  onGenerated,
  generate = generatePracticeText,
}: GenerateTextPanelProps) {
  const t = useTranslations("generate");
  const ids = { topic: useId(), scenario: useId(), hint: useId() };
  const [topic, setTopic] = useState("");
  const [scenario, setScenario] = useState<string>(
    GENERATION_CATEGORIES[0].scenarios[0].id,
  );
  const [level, setLevel] = useState<GenerationLevel>("intermediate");
  const [minutes, setMinutes] = useState<string>("3");
  const [format, setFormat] = useState<GenerationFormat>("dialogue");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<
    Extract<GenerateTextResult, { ok: false }>["reason"] | null
  >(null);

  async function submit() {
    setPending(true);
    setError(null);
    const result = await generate({
      topic,
      scenario: scenario as GenerationRequest["scenario"],
      level,
      minutes: Number(minutes) as GenerationRequest["minutes"],
      format,
    }).catch((): GenerateTextResult => ({ ok: false, reason: "failed" }));
    setPending(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    onGenerated({ title: result.title, text: result.text });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor={ids.scenario} className="block font-medium">
          {t("scenarioLabel")}
        </label>
        <select
          id={ids.scenario}
          value={scenario}
          onChange={(event) => setScenario(event.target.value)}
          disabled={pending}
          className="block w-full max-w-md rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent"
        >
          {GENERATION_CATEGORIES.map((category) => (
            <optgroup key={category.id} label={t(`categories.${category.id}`)}>
              {category.scenarios.map((option) => (
                <option key={option.id} value={option.id}>
                  {t(`scenarios.${option.id}`)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor={ids.topic} className="block font-medium">
          {t("topicLabel")}
        </label>
        <p id={ids.hint} className="text-supporting text-ink-muted">
          {t("topicHint")}
        </p>
        <input
          id={ids.topic}
          type="text"
          value={topic}
          maxLength={TOPIC_MAX_CHARS}
          aria-describedby={ids.hint}
          onChange={(event) => setTopic(event.target.value)}
          disabled={pending}
          className="block w-full rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent"
        />
      </div>
      {(
        [
          [
            "level",
            level,
            LEVELS.map((value) => ({ value, label: t(`levels.${value}`) })),
            (value: string) => setLevel(value as GenerationLevel),
          ],
          [
            "length",
            minutes,
            GENERATION_MINUTES.map((value) => ({
              value: String(value),
              label: t("minutes", { count: value }),
            })),
            setMinutes,
          ],
          [
            "format",
            format,
            GENERATION_FORMATS.map((value) => ({
              value,
              label: t(`formats.${value}`),
            })),
            (value: string) => setFormat(value as GenerationFormat),
          ],
        ] as const
      ).map(([key, value, options, onChange]) => (
        <div key={key} className="space-y-2">
          <p aria-hidden="true" className="font-medium">
            {t(`${key}Legend`)}
          </p>
          <SegmentedControl
            legend={t(`${key}Legend`)}
            value={value}
            options={[...options]}
            onChange={onChange}
            optionWidthClassName="min-w-16"
          />
        </div>
      ))}
      <p className="text-supporting text-ink-muted">{t("note")}</p>
      <Button variant="primary" arrow onClick={submit} disabled={pending}>
        {pending ? t("generating") : t("generate")}
      </Button>
      {error && (
        <p role="alert" className="text-supporting text-error">
          {t(`errors.${error}`)}
        </p>
      )}
    </div>
  );
}
