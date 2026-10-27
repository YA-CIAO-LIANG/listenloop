"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/Button";
import { DayTracker } from "@/components/DayTracker";
import { ProgressBar } from "@/components/ProgressBar";
import { SentenceRow } from "@/components/SentenceRow";
import type { CycleDay, DayStatus } from "@/lib/cycle";

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
