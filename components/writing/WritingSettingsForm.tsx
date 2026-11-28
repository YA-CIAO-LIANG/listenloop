"use client";

import { useTranslations } from "next-intl";
import {
  DEFAULT_WRITING_SETTINGS,
  DICTATION_MODES,
  REVIEW_MODES,
} from "@/lib/writing/settings";
import { REWRITE_LEVELS } from "@/lib/writing/rewrite/types";
import { DAY_FORMATS, FORMAT_DAYS } from "@/lib/writing/day-formats";
import { PlaybackControls } from "../PlaybackControls";
import { useWritingData, useWritingSettings } from "./WritingProvider";

/**
 * Writing settings: what submitting an essay does by default when signed
 * in, AI review or save only (D194), the daily back-translation's mode
 * (D195), the level Day 1's essay is rewritten at (D218), and whether
 * extra practice uses the AI check (D200). Saved at once, in this browser and the account.
 */
export function WritingSettingsForm() {
  const t = useTranslations("writingSettings");
  const tFormats = useTranslations("writing.formats");
  const tPlayback = useTranslations("playback");
  const stored = useWritingSettings();
  const { saveSettings } = useWritingData();
  // Before the browser reads them: the defaults, disabled, so the page
  // doesn't shift when they arrive (Lighthouse CLS, usability round 2).
  const settings = stored ?? DEFAULT_WRITING_SETTINGS;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { at, ...current } = settings;
  const radio = "mt-1 size-4 shrink-0 accent-accent";
  const row = "tap flex min-h-8 items-start gap-3 pointer-coarse:min-h-11";
  return (
    <fieldset
      disabled={!stored}
      aria-busy={!stored}
      className="flex min-w-0 flex-col gap-8"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">{t("review")}</legend>
        {REVIEW_MODES.map((mode) => (
          <label key={mode} className={row}>
            <input
              type="radio"
              name="writing-review"
              value={mode}
              checked={settings.review === mode}
              onChange={() => saveSettings({ ...current, review: mode })}
              className={radio}
            />
            <span>
              {t(`reviewModes.${mode}.label`)}
              <span className="block text-supporting text-ink-muted">
                {t(`reviewModes.${mode}.hint`)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">{t("rewriteLevel")}</legend>
        <p className="text-supporting text-ink-muted">
          {t("rewriteLevelIntro")}
        </p>
        {REWRITE_LEVELS.map((level) => (
          <label key={level} className={row}>
            <input
              type="radio"
              name="writing-rewrite-level"
              value={level}
              checked={settings.rewriteLevel === level}
              onChange={() => saveSettings({ ...current, rewriteLevel: level })}
              className={radio}
            />
            <span>
              {t(`rewriteLevels.${level}.label`)}
              <span className="block text-supporting text-ink-muted">
                {t(`rewriteLevels.${level}.hint`)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-3" data-testid="day-formats">
        <legend className="font-medium">{tFormats("settingsTitle")}</legend>
        <p className="text-supporting text-ink-muted">
          {tFormats("settingsIntro")}
        </p>
        {FORMAT_DAYS.map((day) => (
          <label
            key={day}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
          >
            <span>{tFormats("day", { n: day })}</span>
            <select
              value={settings.formats[day]}
              onChange={(e) =>
                saveSettings({
                  ...current,
                  formats: {
                    ...settings.formats,
                    [day]: e.target.value as (typeof DAY_FORMATS)[number],
                  },
                })
              }
              className="min-h-8 rounded-base border border-line bg-surface px-2 pointer-coarse:min-h-11"
            >
              {DAY_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {tFormats(`${format}.name`)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">{tPlayback("title")}</legend>
        <PlaybackControls />
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">{t("dictation")}</legend>
        {DICTATION_MODES.map((mode) => (
          <label key={mode} className={row}>
            <input
              type="radio"
              name="writing-dictation"
              value={mode}
              checked={settings.dictation === mode}
              onChange={() => saveSettings({ ...current, dictation: mode })}
              className={radio}
            />
            <span>
              {t(`dictationModes.${mode}.label`)}
              <span className="block text-supporting text-ink-muted">
                {t(`dictationModes.${mode}.hint`)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">{t("coach.title")}</legend>
        <p className="text-supporting text-ink-muted">{t("coach.intro")}</p>
        {(["confidence", "scaffold", "selfExplain", "day30"] as const).map(
          (name) => (
            <label key={name} className={row}>
              <input
                type="checkbox"
                checked={settings[name]}
                onChange={(e) =>
                  saveSettings({ ...current, [name]: e.target.checked })
                }
                className={radio}
              />
              <span>
                {t(`coach.${name}.label`)}
                <span className="block text-supporting text-ink-muted">
                  {t(`coach.${name}.hint`)}
                </span>
              </span>
            </label>
          ),
        )}
        <label className={row}>
          <input
            type="checkbox"
            checked={settings.bedtime}
            onChange={(e) =>
              saveSettings({ ...current, bedtime: e.target.checked })
            }
            className={radio}
          />
          <span>
            {t("coach.bedtime.label")}
            <span className="block text-supporting text-ink-muted">
              {t("coach.bedtime.hint")}
            </span>
          </span>
        </label>
        <label className="ml-7 flex flex-wrap items-center gap-2 text-supporting">
          {t("coach.bedtime.at")}
          <input
            type="time"
            value={settings.bedtimeAt}
            disabled={!settings.bedtime}
            onChange={(e) =>
              /^\d\d:\d\d$/.test(e.target.value) &&
              saveSettings({ ...current, bedtimeAt: e.target.value })
            }
            className="min-h-8 rounded-base border border-line bg-surface px-2 disabled:opacity-50 pointer-coarse:min-h-11"
          />
        </label>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">{t("extra")}</legend>
        <label className={row}>
          <input
            type="checkbox"
            checked={!settings.extraAi}
            onChange={(e) =>
              saveSettings({ ...current, extraAi: !e.target.checked })
            }
            className={radio}
          />
          <span>
            {t("extraNoAi")}
            <span className="block text-supporting text-ink-muted">
              {t("extraNoAiHint")}
            </span>
          </span>
        </label>
      </fieldset>
    </fieldset>
  );
}
