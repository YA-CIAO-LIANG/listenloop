"use client";

import { useTranslations } from "next-intl";
import { REVIEW_MODES } from "@/lib/writing/settings";
import { useWritingData, useWritingSettings } from "./WritingProvider";

/**
 * Writing settings (D194): what submitting an essay does by default when
 * signed in, AI review or save only. Saved at once, in this browser and
 * the account.
 */
export function WritingSettingsForm() {
  const t = useTranslations("writingSettings");
  const settings = useWritingSettings();
  const { saveSettings } = useWritingData();
  if (!settings) return null;
  const current = { review: settings.review, dictation: settings.dictation };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-medium">{t("review")}</legend>
      {REVIEW_MODES.map((mode) => (
        <label
          key={mode}
          className="tap flex min-h-8 items-start gap-3 pointer-coarse:min-h-11"
        >
          <input
            type="radio"
            name="writing-review"
            value={mode}
            checked={settings.review === mode}
            onChange={() => saveSettings({ ...current, review: mode })}
            className="mt-1 size-4 shrink-0 accent-accent"
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
  );
}
