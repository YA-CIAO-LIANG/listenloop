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

/** The home page's calendar and today's tasks. */
export function HomeProgress() {
  return (
    <>
      <PracticeCalendar />
      <TodayTasks />
    </>
  );
}
