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
 * The home page's weekly report (Mondays, D176), listening calendar, and
 * today's listening tasks. Writing's calendar and streak are on /writing
 * (D214); its today's tasks follow these on the home page.
 */
export function HomeProgress() {
  return (
    <>
      <WeeklyReport />
      <PracticeCalendar />
      <TodayTasks />
    </>
  );
}
