"use client";

import { useTranslations } from "next-intl";
import type { Speaker } from "@/lib/custom-practice/speakers";
import { Button } from "./Button";

/**
 * Which speaker reads a sentence in a two-voice dialogue (D57): a small
 * button showing "A" or "B"; pressing it switches. The label says which
 * sentence and who reads it now.
 */
export function SpeakerToggle({
  speaker,
  index,
  onChange,
  disabled = false,
}: {
  speaker: Speaker;
  /** The sentence's 0-based position, for the label. */
  index: number;
  onChange: (speaker: Speaker) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("speakers");
  const name = speaker === 1 ? "B" : "A";
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-label={t("toggleLabel", { n: index + 1, speaker: name })}
      onClick={() => onChange(speaker === 1 ? 0 : 1)}
      disabled={disabled}
      className="w-10 shrink-0 justify-center"
    >
      {name}
    </Button>
  );
}
