import { useTranslations } from "next-intl";

/**
 * Reminder below the player to turn captions off. YouTube shows captions
 * based on the viewer's own preference and offers no documented way to force
 * them off, and covering the player is not allowed (see CLAUDE.md).
 */
export function CaptionHint() {
  const t = useTranslations("player");
  return (
    <p className="mt-2 text-supporting text-ink-muted">
      <span aria-hidden="true">ⓘ </span>
      {t("captionHint")}
    </p>
  );
}
