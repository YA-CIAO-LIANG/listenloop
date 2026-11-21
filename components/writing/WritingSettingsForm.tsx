"use client";

import { useTranslations } from "next-intl";
import { DICTATION_MODES, REVIEW_MODES } from "@/lib/writing/settings";
import { useWritingData, useWritingSettings } from "./WritingProvider";

/**
 * Writing settings: what submitting an essay does by default when signed
 * in, AI review or save only (D194), and the daily back-translation's
 * mode (D195). Saved at once, in this browser and the account.
 */
export function WritingSettingsForm() {
  const t = useTranslations("writingSettings");
  const settings = useWritingSettings();
  const { saveSettings } = useWritingData();
  if (!settings) return null;
  const current = { review: settings.review, dictation: settings.dictation };
  const radio = "mt-1 size-4 shrink-0 accent-accent";
  const row = "tap flex min-h-8 items-start gap-3 pointer-coarse:min-h-11";
  return (
    <div className="flex flex-col gap-8">
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
    </div>
  );
}
