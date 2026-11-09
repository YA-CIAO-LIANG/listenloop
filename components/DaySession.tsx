"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import type { CycleDay } from "@/lib/cycle";
import type { PracticeMaterial } from "@/lib/practice-material";
import { isShadowingDay } from "@/lib/shadowing";

// A day is dictation or shadowing, never both: the page loads only the
// one it shows (D120). Both still render on the server, so nothing shifts.
const DictationSession = dynamic(() =>
  import("./DictationSession").then((m) => m.DictationSession),
);
const ShadowingSession = dynamic(() =>
  import("./ShadowingSession").then((m) => m.ShadowingSession),
);

/** A practice day's session: shadowing on Days 2–6, dictation otherwise. */
export function DaySession({
  video,
  day,
  title,
  startInRetry,
  children,
}: {
  video: PracticeMaterial;
  day: CycleDay;
  title: string;
  startInRetry: boolean;
  children?: ReactNode;
}) {
  return isShadowingDay(day) ? (
    <ShadowingSession
      video={video}
      day={day}
      title={title}
      startInRetry={startInRetry}
    >
      {children}
    </ShadowingSession>
  ) : (
    <DictationSession
      video={video}
      day={day === 7 ? 7 : 1}
      title={title}
      startInRetry={startInRetry}
    >
      {children}
    </DictationSession>
  );
}
