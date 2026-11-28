"use client";

import dynamic from "next/dynamic";

// Signed-in learners only (ProgressGate), like HomeProgress (D120).
const WritingTasks = dynamic(() =>
  import("./WritingTasks").then((m) => m.WritingTasks),
);
const WritingCalendar = dynamic(() =>
  import("./WritingCalendar").then((m) => m.WritingCalendar),
);

/**
 * The home page's writing half (D217): today's writing and writing's own
 * calendar (with its streak), in the writing color, after listening's.
 * Two separate calendars, never added together (D214).
 */
export function HomeWriting({ titles }: { titles: Record<string, string> }) {
  return (
    <div data-area="writing" className="space-y-6">
      <WritingTasks titles={titles} />
      <WritingCalendar titles={titles} />
    </div>
  );
}
