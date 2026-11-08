"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/Button";
import { DayTracker } from "@/components/DayTracker";
import { Dialog } from "@/components/Dialog";
import { SpeakerIcon } from "@/components/icons";
import { MaterialCard } from "@/components/MaterialCard";
import { LibraryFilters } from "@/components/MaterialLibrary";
import { Tag } from "@/components/Tag";
import { ProgressBar } from "@/components/ProgressBar";
import { SentenceRow } from "@/components/SentenceRow";
import { VoiceMenu, voiceSampleUrl } from "@/components/VoiceMenu";
import type { CycleDay, DayStatus } from "@/lib/cycle";
import {
  NO_LIBRARY_FILTER,
  type LibraryFilter,
  type LibraryItem,
} from "@/lib/library";

// Sample practice content (not UI copy), like a video's sentences.
const sampleSentences = [
  "We moved to the city last year.",
  "It took a while to settle in.",
  "We found a small apartment near the river.",
];

/** Click a sentence to make it current; earlier ones show as done. */
export function SentenceRowDemo() {
  const [current, setCurrent] = useState(1);

  return (
    <div className="border-t border-line">
      {sampleSentences.map((sentence, index) => (
        <SentenceRow
          key={sentence}
          index={index}
          status={
            index < current ? "done" : index === current ? "current" : "pending"
          }
          score={index < current ? 1 - index * 0.15 : undefined}
          hidden={index > current}
          onSelect={() => setCurrent(index)}
        >
          {sentence}
        </SentenceRow>
      ))}
    </div>
  );
}

/** Click an unlocked day to make it "today". */
export function DayTrackerDemo() {
  const [today, setToday] = useState<CycleDay>(3);
  const statuses = Array.from({ length: 7 }, (_, index): DayStatus => {
    const day = index + 1;
    if (day < today) return "done";
    if (day === today) return "today";
    return day === today + 1 ? "available" : "locked";
  });

  return <DayTracker statuses={statuses} onSelect={setToday} />;
}

/** Step through progress to see the leading-dot hop and the final check. */
export function ProgressBarDemo() {
  const t = useTranslations("styleguide.progressDemo");
  const tProgress = useTranslations("practice.progress");
  const total = 12;
  const [value, setValue] = useState(2);
  const done = value >= total;

  return (
    <div className="space-y-4">
      <ProgressBar value={value} max={total} label={tProgress("today")} />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="primary"
          disabled={done}
          onClick={() => setValue((v) => Math.min(v + 1, total))}
        >
          {t("add")}
        </Button>
        <Button size="sm" disabled={done} onClick={() => setValue(total)}>
          {t("complete")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setValue(0)}>
          {t("reset")}
        </Button>
      </div>
    </div>
  );
}

/** The voice cards with the real sample clips. */
/** The voice menu (e+ 3) with the real sample clips. */
export function VoiceMenuDemo() {
  const [voice, setVoice] = useState("us-female");
  return (
    <VoiceMenu value={voice} onChange={setVoice} sampleUrl={voiceSampleUrl} />
  );
}

// Sample library items (content, not UI copy): an official practice for
// an exam, and a video.
const sampleItems: LibraryItem[] = [
  {
    id: "p-styleguide-1",
    kind: "audio",
    title: "Rescheduling the Client Meeting",
    subtitle: null,
    category: "exam",
    scenario: null,
    exam: "toeic",
    examTarget: "toeic-750",
    level: "intermediate",
    seconds: 125,
    accent: "au",
    sentenceCount: 16,
    createdAt: "2026-11-07T00:00:00Z",
    sortOrder: 1,
    learners: 4,
  },
  {
    id: "sintel",
    kind: "video",
    title: "Sintel",
    subtitle: null,
    category: "talks-stories",
    scenario: null,
    exam: null,
    examTarget: null,
    level: "advanced",
    seconds: 49,
    accent: null,
    sentenceCount: 12,
    createdAt: "2026-10-24T00:00:00Z",
    sortOrder: null,
    learners: 9,
  },
];

/** MaterialCard and Tag (D70), with a subtitle from the message files. */
export function MaterialCardDemo() {
  const t = useTranslations("styleguide.library");
  return (
    <div className="space-y-6">
      <p className="flex flex-wrap gap-2">
        <Tag icon={<SpeakerIcon className="size-4" />}>{t("tagAudio")}</Tag>
        <Tag>{t("tagLevel")}</Tag>
      </p>
      <ul className="grid gap-6 split:grid-cols-2">
        {sampleItems.map((item) => (
          <li key={item.id}>
            <MaterialCard item={{ ...item, subtitle: t("subtitle") }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The filter groups, and the bottom drawer phones open them in (D70). */
export function LibraryFiltersDemo() {
  const t = useTranslations("styleguide.library");
  const [filter, setFilter] = useState<LibraryFilter>(NO_LIBRARY_FILTER);
  const [sheet, setSheet] = useState(false);
  return (
    <div className="space-y-6">
      <div className="max-w-sm">
        <LibraryFilters
          items={sampleItems}
          filter={filter}
          onChange={setFilter}
        />
      </div>
      <Button variant="secondary" onClick={() => setSheet(true)}>
        {t("openSheet")}
      </Button>
      {sheet && (
        <Dialog
          title={t("sheetTitle")}
          variant="sheet"
          onClose={() => setSheet(false)}
        >
          <LibraryFilters
            items={sampleItems}
            filter={filter}
            onChange={setFilter}
          />
          <Button variant="primary" onClick={() => setSheet(false)}>
            {t("closeSheet")}
          </Button>
        </Dialog>
      )}
    </div>
  );
}
