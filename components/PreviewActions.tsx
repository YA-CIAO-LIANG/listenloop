"use client";

import { useTranslations } from "next-intl";
import { recordIntent } from "@/app/intent-actions";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { useSamplePlayer } from "./useSamplePlayer";

/** Where the preview's upgrade button goes; recorded as its source. */
export const PREVIEW_PRICING_HREF = "/pricing?from=shared-preview";

/**
 * The preview's buttons (D106): listen to the first sentence, and
 * "Upgrade to practice this", which goes to the pricing page with the
 * preview as its source in the paying-interest funnel (D93).
 */
export function PreviewActions({
  practiceId,
  audioUrl,
  record = recordIntent,
}: {
  practiceId: string;
  audioUrl: string | null;
  record?: typeof recordIntent;
}) {
  const t = useTranslations("sharedPreview");
  const { playing, toggle } = useSamplePlayer(() => audioUrl);

  return (
    <div className="flex flex-wrap gap-3">
      {audioUrl && (
        <Button
          variant="secondary"
          aria-pressed={playing !== null}
          onClick={() => toggle(practiceId)}
        >
          {playing ? t("stop") : t("listen")}
        </Button>
      )}
      <ButtonLink
        href={PREVIEW_PRICING_HREF}
        variant="primary"
        arrow
        onClick={() => {
          void record({
            step: "unlock_click",
            item: "shared-practice",
            source: "shared-preview",
          });
        }}
      >
        {t("upgrade")}
      </ButtonLink>
    </div>
  );
}
