"use client";

import { useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  parseVoiceId,
  VOICE_ACCENTS,
  VOICE_GENDERS,
  voiceId,
} from "@/lib/ai/types";
import { voiceDisplayName } from "@/lib/ai/voices";
import { Button } from "./Button";
import { ChevronDownIcon, SpeakerIcon, StopIcon } from "./icons";
import { useSamplePlayer } from "./useSamplePlayer";

type VoiceMenuProps = {
  /** The chosen voice id, e.g. "us-female". */
  value: string;
  onChange: (id: string) => void;
  /** A short sample clip for each voice id, or null if there isn't one. */
  sampleUrl: (id: string) => string | null;
  disabled?: boolean;
};

/**
 * Choosing the voice a practice is read in, as a pop-up menu like Apple's
 * (e+ 3): a field-like button shows the chosen voice; it opens a panel
 * grouped by accent, each group with a line on how that accent sounds,
 * and each voice with its name, gender, and a listen button.
 *
 * The voices are native radios (arrow keys move and choose), not a
 * listbox, because each one sits next to its own listen button. A click
 * or Enter on a voice closes the menu; Escape, a click outside, or tabbing
 * away closes it too, and focus returns to the button.
 */
export function VoiceMenu({
  value,
  onChange,
  sampleUrl,
  disabled = false,
}: VoiceMenuProps) {
  const t = useTranslations("voicePicker");
  const id = useId();
  const [open, setOpen] = useState(false);
  const { playing, toggle } = useSamplePlayer(sampleUrl);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const describe = (voice: string) => {
    const parsed = parseVoiceId(voice);
    if (!parsed) return { name: voice, gender: "", accent: "" };
    return {
      name: voiceDisplayName(voice) ?? voice,
      gender: t(`genders.${parsed.gender}`),
      accent: t(`accents.${parsed.accent}`),
    };
  };
  const chosen = describe(value);

  function close({ focusButton = true } = {}) {
    setOpen(false);
    if (playing) toggle(playing);
    if (focusButton) buttonRef.current?.focus();
  }

  // Opening puts focus on the chosen voice, like a native menu.
  useEffect(() => {
    if (!open) return;
    panelRef.current
      ?.querySelector<HTMLInputElement>("input:checked, input")
      ?.focus();
  }, [open]);

  // A press outside the menu closes it, leaving focus where it went.
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        close({ focusButton: false });
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  });

  function onPanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (
      (event.key === "Enter" || event.key === " ") &&
      event.target instanceof HTMLInputElement
    ) {
      event.preventDefault();
      onChange(event.target.value);
      close();
    }
  }

  // Arrow keys "click" radios too (detail 0); only a real click closes.
  function onVoiceClick(event: MouseEvent<HTMLInputElement>) {
    if (event.detail > 0) close();
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        // Tabbing away closes it. (A click inside may focus nothing, as
        // in Safari, so a blur to nowhere isn't leaving; clicks outside
        // are handled above.)
        const next = event.relatedTarget as Node | null;
        if (open && next && !rootRef.current?.contains(next)) {
          close({ focusButton: false });
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-label={t("menuLabel", {
          voice: t("optionLabel", chosen),
        })}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        className="flex w-full max-w-md items-center justify-between gap-3 rounded-base border border-line bg-surface px-4 py-3 text-left transition-colors duration-(--ll-duration-transition) hover:border-ink-muted focus-visible:border-accent disabled:opacity-50 aria-expanded:border-accent"
      >
        <span className="min-w-0">
          <span className="font-medium">{chosen.name}</span>
          <span className="text-ink-muted">
            {" · "}
            {chosen.gender}
            {" · "}
            {chosen.accent}
          </span>
        </span>
        <ChevronDownIcon
          className={`size-5 shrink-0 text-ink-muted transition-transform duration-(--ll-duration-transition) motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        ref={panelRef}
        id={`${id}-panel`}
        hidden={!open}
        onKeyDown={onPanelKeyDown}
        className="absolute inset-x-0 z-20 mt-2 max-h-[min(32rem,70vh)] w-full overflow-y-auto rounded-base border border-line bg-surface p-2 split:right-auto split:w-md"
      >
        <fieldset>
          <legend className="sr-only">{t("legend")}</legend>
          {VOICE_ACCENTS.map((accent) => (
            <div
              key={accent}
              role="group"
              aria-labelledby={`${id}-${accent}`}
              aria-describedby={`${id}-${accent}-note`}
              className="border-b border-line py-2 last:border-b-0"
            >
              <p id={`${id}-${accent}`} className="px-3 pt-1 font-medium">
                {t(`accents.${accent}`)}
              </p>
              <p
                id={`${id}-${accent}-note`}
                className="px-3 pb-2 text-supporting text-ink-muted"
              >
                {t(`accentNotes.${accent}`)}
              </p>
              <ul>
                {VOICE_GENDERS.map((gender) => {
                  const voice = voiceId({ accent, gender });
                  const option = describe(voice);
                  const checked = value === voice;
                  const isPlaying = playing === voice;
                  const label = t("optionLabel", option);
                  return (
                    <li
                      key={voice}
                      className="flex items-center gap-2 rounded-base has-checked:bg-accent/8 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-focus has-[input:focus-visible]:outline-solid"
                    >
                      <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 rounded-base px-3 hover:bg-ink/4">
                        <input
                          type="radio"
                          name={`${id}-voice`}
                          value={voice}
                          checked={checked}
                          onChange={() => onChange(voice)}
                          onClick={onVoiceClick}
                          aria-label={label}
                          className="sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={`w-4 text-accent-ink ${checked ? "" : "invisible"}`}
                        >
                          ✓
                        </span>
                        <span>
                          <span className="font-medium">{option.name}</span>
                          <span className="text-ink-muted">
                            {" · "}
                            {option.gender}
                          </span>
                        </span>
                      </label>
                      <Button
                        size="sm"
                        variant={isPlaying ? "primary" : "ghost"}
                        aria-label={t(isPlaying ? "stopLabel" : "listenLabel", {
                          voice: label,
                        })}
                        aria-pressed={isPlaying}
                        disabled={!sampleUrl(voice)}
                        onClick={() => toggle(voice)}
                        className="mr-1 w-11 justify-center px-0"
                      >
                        {isPlaying ? (
                          <StopIcon className="size-4" />
                        ) : (
                          <SpeakerIcon className="size-5" />
                        )}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
