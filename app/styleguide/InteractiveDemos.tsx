"use client";

import { useState } from "react";
import { DayTracker } from "@/components/DayTracker";
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
