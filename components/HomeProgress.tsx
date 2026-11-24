"use client";

import dynamic from "next/dynamic";

// Only signed-in learners see these (ProgressGate): a signed-out visitor,
// most first visits, doesn't load their code (D120). They still render on
// the server for signed-in learners, so nothing shifts.
const PracticeCalendar = dynamic(() =>
  import("./PracticeCalendar").then((m) => m.PracticeCalendar),
);
const TodayTasks = dynamic(() =>
  import("./TodayTasks").then((m) => m.TodayTasks),
);
const WeeklyReport = dynamic(() =>
  import("./WeeklyReport").then((m) => m.WeeklyReport),
);

/**
 * The home page's weekly report (Mondays, D176), calendar, and today's
 * tasks.
 */
export function HomeProgress({
  writingTitles,
}: {
  /** Official writing prompts' titles, for the calendar (D201). */
  writingTitles?: Record<string, string>;
}) {
  return (
    <>
      <WeeklyReport />
      <PracticeCalendar writingTitles={writingTitles} />
      <TodayTasks />
    </>
  );
}
