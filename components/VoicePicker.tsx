"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import {
  VOICE_ACCENTS,
  VOICE_GENDERS,
  voiceId,
  type VoiceAccent,
} from "@/lib/ai/types";
import { Button } from "./Button";

/** BCP 47 tag shown on each card, e.g. "en-US". */
const LOCALE: Record<VoiceAccent, string> = {
  us: "en-US",
  gb: "en-GB",
  au: "en-AU",
  in: "en-IN",
};

/** The clip each card plays, made by `npm run voices:samples`. */
export const voiceSampleUrl = (id: string) => `/voices/${id}.mp3`;

type VoicePickerProps = {
  /** The chosen voice id, e.g. "us-female". */
  value: string;
  onChange: (id: string) => void;
  /** A short sample clip for each voice id, or null if there isn't one. */
  sampleUrl: (id: string) => string | null;
  disabled?: boolean;
};

/**
 * Choosing the voice a practice is read in: one card per voice, grouped by
 * accent, each with a "Listen" button that plays a sample (D26). The cards
 * are native radios, so arrow keys move between them; the chosen card
 * shows an accent border, a tint, and a ✓, never color alone.
 */
export function VoicePicker({
  value,
  onChange,
  sampleUrl,
  disabled = false,
}: VoicePickerProps) {
  const t = useTranslations("voicePicker");
  const name = useId();
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // One player for every card, so only one sample plays at a time.
  useEffect(() => {
    const audio = new Audio();
    const stopped = () => setPlaying(null);
    audio.addEventListener("ended", stopped);
    audio.addEventListener("error", stopped);
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.removeEventListener("ended", stopped);
      audio.removeEventListener("error", stopped);
      audioRef.current = null;
    };
  }, []);

  function toggleSample(id: string) {
    const audio = audioRef.current;
    const url = sampleUrl(id);
    if (!audio || !url) return;
    if (playing === id) {
      audio.pause();
      setPlaying(null);
      return;
    }
    audio.src = url;
    audio.currentTime = 0;
    setPlaying(id);
    audio.play().catch(() => setPlaying(null));
  }

  return (
    <fieldset disabled={disabled} className="space-y-6">
      <legend className="sr-only">{t("legend")}</legend>
      <div className="grid gap-6 split:grid-cols-2">
        {VOICE_ACCENTS.map((accent) => (
          <div
            key={accent}
            role="group"
            aria-labelledby={`${name}-${accent}`}
            className="space-y-3"
          >
            <p id={`${name}-${accent}`} className="font-medium">
              {t(`accents.${accent}`)}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {VOICE_GENDERS.map((gender) => {
                const id = voiceId({ accent, gender });
                const checked = value === id;
                const voiceName = t("voiceName", {
                  accent: t(`accents.${accent}`),
                  gender: t(`genders.${gender}`),
                });
                const isPlaying = playing === id;
                return (
                  <div
                    key={id}
                    className="flex flex-col rounded-base border border-line bg-surface transition-colors duration-(--ll-duration-transition) hover:border-ink-muted has-checked:border-accent has-checked:bg-accent/8 has-checked:hover:border-accent has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus has-[input:focus-visible]:outline-solid"
                  >
                    <label className="flex flex-1 cursor-pointer items-start justify-between gap-2 px-4 pt-4 pb-2">
                      <input
                        type="radio"
                        name={name}
                        value={id}
                        checked={checked}
                        onChange={() => onChange(id)}
                        aria-label={voiceName}
                        className="sr-only"
                      />
                      <span>
                        <span className="block font-display text-h3">
                          {t(`genders.${gender}`)}
                        </span>
                        <span className="block text-metadata tracking-widest text-ink-muted">
                          {LOCALE[accent]}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={`text-accent-ink ${checked ? "" : "invisible"}`}
                      >
                        ✓
                      </span>
                    </label>
                    <div className="px-4 pb-4">
                      <Button
                        size="sm"
                        variant={isPlaying ? "primary" : "secondary"}
                        aria-label={t(isPlaying ? "stopLabel" : "listenLabel", {
                          voice: voiceName,
                        })}
                        aria-pressed={isPlaying}
                        disabled={!sampleUrl(id)}
                        onClick={() => toggleSample(id)}
                      >
                        {isPlaying ? t("playing") : t("listen")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
